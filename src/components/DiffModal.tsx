import { useEffect, useMemo } from "react";
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
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);
  return (
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="diff" role="dialog" aria-modal="true" aria-label={title}>
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
      </div>
    </div>
  );
}
