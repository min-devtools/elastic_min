import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Icon, type IconName } from "./Icon";

export interface ContextMenuItem {
  icon: IconName;
  label: string;
  strong?: boolean;
  /** shortcut hint rendered right-aligned (e.g. "⌘D") */
  kbd?: string;
  onClick: () => void;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // clamp to viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) el.style.left = `${window.innerWidth - rect.width - 12}px`;
    if (rect.bottom > window.innerHeight) el.style.top = `${window.innerHeight - rect.height - 12}px`;
  }, [x, y]);

  useEffect(() => {
    itemRefs.current[0]?.focus();
  }, [x, y]);

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const available = itemRefs.current.filter((item): item is HTMLButtonElement => !!item);
    if (!available.length) return;
    const current = Math.max(0, available.indexOf(document.activeElement as HTMLButtonElement));
    const next =
      event.key === "Home" ? 0
      : event.key === "End" ? available.length - 1
      : event.key === "ArrowDown" ? (current + 1) % available.length
      : (current - 1 + available.length) % available.length;
    available[next]?.focus();
  };

  return (
    <motion.div
      ref={ref}
      className="index-context-menu"
      role="menu"
      aria-label="Actions"
      onKeyDown={onMenuKeyDown}
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0.93, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.93 }}
      transition={{ duration: 0.14, ease: [0.32, 0.72, 0, 1] }}
    >
      {items.map((item, index) => (
        <button
          key={item.label}
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          type="button"
          role="menuitem"
          className="context-item"
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          <Icon name={item.icon} size={15} />
          {item.strong ? <strong>{item.label}</strong> : <span>{item.label}</span>}
          {item.kbd ? <span className="kbd">{item.kbd}</span> : <span />}
        </button>
      ))}
    </motion.div>
  );
}
