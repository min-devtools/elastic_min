import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "./Icon";
import { ToolButton } from "./ToolButton";

/** keep in sync with `.path-dropdown { max-height }` in views.css */
const DROPDOWN_MAX_H = 320;

interface Props {
  columns: string[];
  visibleColumns: string[];
  onToggle: (col: string) => void;
  onMove: (from: number, to: number) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onAddPath?: (path: string) => void;
  pathPlaceholder?: string;
  paths?: string[];
  enabledPaths?: Set<string>;
  onTogglePath?: (path: string) => void;
  onRemovePath?: (path: string) => void;
}

/** Column picker + path input + pills shared by Documents and Search Results. */
export function ColumnControls({
  columns, visibleColumns, onToggle, onMove, onShowAll, onHideAll,
  onAddPath, pathPlaceholder = "Add JSON path, e.g. payment.provider",
  paths = [], enabledPaths = new Set(), onTogglePath, onRemovePath,
}: Props) {
  const [pathInput, setPathInput] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownFilter, setDropdownFilter] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; right: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const addPath = () => {
    const p = pathInput.trim();
    if (!p || !onAddPath) return;
    onAddPath(p);
    setPathInput("");
  };

  // empty column list counts as "nothing shown" so the toggle offers Show all, not Hide all
  const allVisible = columns.length > 0 && visibleColumns.length >= columns.length;

  const filteredColumns = useMemo(() => {
    const q = dropdownFilter.trim().toLowerCase();
    return q ? columns.filter((c) => c.toLowerCase().includes(q)) : columns;
  }, [columns, dropdownFilter]);

  useEffect(() => {
    if (!dropdownOpen) { setDropdownStyle(null); return; }
    // re-anchor on scroll/resize — panel resizes (double-click expand) would strand a fixed dropdown
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      // flip above the button when the panel sits low enough that 320px would run off-screen
      const below = window.innerHeight - rect.bottom - 12;
      const top = below < DROPDOWN_MAX_H ? Math.max(8, rect.top - 6 - DROPDOWN_MAX_H) : rect.bottom + 6;
      setDropdownStyle({ top, right: window.innerWidth - rect.right });
    };
    place();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDropdownOpen(false); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dropdownRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setDropdownOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [dropdownOpen]);

  const onDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const onDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const onDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndex ?? Number(e.dataTransfer.getData("text/plain"));
    if (from !== index) onMove(from, index);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const onDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <>
      <div className="path-controls">
        {onAddPath && (
          <input className="path-input" value={pathInput} placeholder={pathPlaceholder}
            onChange={(e) => setPathInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPath()} />
        )}
        <div className="path-actions">
          {onAddPath && <ToolButton onClick={addPath}><Icon name="plus" /> Add path</ToolButton>}
          <ToolButton ref={buttonRef} iconOnly className={dropdownOpen ? "active" : ""}
            title="Show/hide and reorder columns" aria-label="Show/hide and reorder columns"
            onClick={() => { setDropdownOpen((v) => !v); setDropdownFilter(""); }}>
            <Icon name="rows" />
          </ToolButton>
        </div>
      </div>

      {paths.length > 0 && onTogglePath && onRemovePath && (
        <div className="path-pills">
          <AnimatePresence initial={false}>
            {paths.map((p) => (
              <motion.div
                key={p}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                className={`path-pill ${enabledPaths.has(p) ? "active" : ""}`}
                title="Toggle this path" onClick={() => onTogglePath(p)}>
                <span className="path-pill-label">{p}</span>
                <button type="button" className="path-pill-copy" title="Fill path input" aria-label={`Fill ${p} in path input`}
                  onClick={(e) => { e.stopPropagation(); setPathInput(p); }}>
                  <Icon name="copy" size={12} />
                </button>
                <button type="button" className="path-pill-remove" title="Remove path" aria-label={`Remove ${p}`}
                  onClick={(e) => { e.stopPropagation(); onRemovePath(p); }}>
                  ×
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {createPortal(
        <AnimatePresence>
          {dropdownOpen && dropdownStyle && (
            <motion.div
              ref={dropdownRef}
              key="path-dropdown"
              className="path-dropdown"
              style={{ position: "fixed", top: dropdownStyle.top, right: dropdownStyle.right, zIndex: 1000 }}
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.14, ease: [0.32, 0.72, 0, 1] }}
            >
              <input autoFocus className="path-dropdown-filter" placeholder="Filter columns" value={dropdownFilter}
                onChange={(e) => setDropdownFilter(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setDropdownOpen(false)} />
              <div className="path-dropdown-all">
                <button type="button" onClick={allVisible ? onHideAll : onShowAll}>
                  <Icon name={allVisible ? "x" : "check"} size={12} />
                  {allVisible ? "Hide all" : "Show all"}
                </button>
                <span className="path-dropdown-count">{visibleColumns.length}/{columns.length}</span>
              </div>
              <div className="path-dropdown-list">
                {filteredColumns.map((c) => {
                  const idx = columns.indexOf(c);
                  const visible = visibleColumns.includes(c);
                  const isDragging = dragIndex === idx;
                  const isDragOver = dragOverIndex === idx;
                  return (
                    <div
                      key={c}
                      className={`path-dropdown-item ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""}`}
                      draggable
                      onDragStart={onDragStart(idx)}
                      onDragOver={onDragOver(idx)}
                      onDrop={onDrop(idx)}
                      onDragEnd={onDragEnd}
                    >
                      <button type="button" className="path-dropdown-check" title={visible ? "Hide column" : "Show column"}
                        aria-label={`${visible ? "Hide" : "Show"} ${c} column`}
                        onClick={() => onToggle(c)}>
                        <Icon name={visible ? "check" : "x"} size={13} />
                      </button>
                      <span className="path-dropdown-name">{c}</span>
                      <span className="path-dropdown-grip" title="Drag to reorder">
                        <Icon name="rows" size={12} />
                      </span>
                    </div>
                  );
                })}
                {filteredColumns.length === 0 && <span className="path-dropdown-empty">no matching columns</span>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
