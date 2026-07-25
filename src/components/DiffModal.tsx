import { useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { ToolButton } from "../ui/ToolButton";
import { Badge } from "../ui/Badge";
import { diffLines } from "../lib/format";

interface Props {
  title: string;
  badge: string;
  before: string;
  after: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

export function DiffModal({ title, badge, before, after, onCancel, onConfirm, confirmLabel = "Save document" }: Props) {
  const diff = useMemo(() => diffLines(before, after), [before, after]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") onCancel();
      else onConfirm();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel, onConfirm]);

  // no AnimatePresence here — the caller owns the mount/unmount and wraps it. A nested
  // AnimatePresence would provide its own PresenceContext with isPresent:true, shadowing
  // the caller's exit signal, and these motion.divs would never run their exit.
  return (
    <motion.div
      className="modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        className="diff"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <div className="diff-head">
          <strong>{title}</strong>
          <Badge>{badge}</Badge>
        </div>
        <div className="diff-body">
          <pre className="diff-code" dangerouslySetInnerHTML={{ __html: diff.left }} />
          <pre className="diff-code" dangerouslySetInnerHTML={{ __html: diff.right }} />
        </div>
        <div className="diff-foot">
          <ToolButton onClick={onCancel}>Cancel</ToolButton>
          <ToolButton variant="primary" onClick={onConfirm}>{confirmLabel}</ToolButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
