import { useRef, type ReactNode } from "react";
import type { SortState } from "../lib/useSort";

export function SortTh({
  col, sort, onSort, children, onClick, onDragStart, onDragEnd, style, ...rest
}: {
  col: string;
  sort: SortState;
  onSort: (col: string) => void;
  children: ReactNode;
} & React.ThHTMLAttributes<HTMLTableCellElement>) {
  const dragStarted = useRef(false);

  return (
    <th
      {...rest}
      onDragStart={(event) => {
        dragStarted.current = true;
        onDragStart?.(event);
      }}
      onDragEnd={(event) => {
        onDragEnd?.(event);
        // A browser click, when emitted after dragend, arrives before this task.
        setTimeout(() => {
          dragStarted.current = false;
        }, 0);
      }}
      onClick={(event) => {
        if (dragStarted.current) {
          dragStarted.current = false;
          event.preventDefault();
          return;
        }
        onClick?.(event);
        if (!event.defaultPrevented) onSort(col);
      }}
      style={{ cursor: "pointer", ...style }}
    >
      {children}
      {sort?.col === col && <span className="sort-arrow">{sort.dir === "desc" ? " ▼" : " ▲"}</span>}
    </th>
  );
}
