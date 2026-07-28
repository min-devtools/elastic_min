export interface GridPosition {
  row: number;
  col: number;
}

const inGrid = (
  position: GridPosition | null,
  rowCount: number,
  columnCount: number,
): position is GridPosition =>
  !!position &&
  position.row >= 0 &&
  position.row < rowCount &&
  position.col >= 0 &&
  position.col < columnCount;

/** Resolve the grid's single tab stop: keyboard-active, selected, then first cell. */
export function resolveTabbableGridPosition(
  active: GridPosition | null,
  selected: GridPosition | null,
  rowCount: number,
  columnCount: number,
): GridPosition | null {
  if (inGrid(active, rowCount, columnCount)) return active;
  if (inGrid(selected, rowCount, columnCount)) return selected;
  return rowCount > 0 && columnCount > 0 ? { row: 0, col: 0 } : null;
}

/** Return the adjacent cell for arrow-key navigation, or null at a grid edge. */
export function nextGridPosition(
  row: number,
  col: number,
  key: string,
  rowCount: number,
  columnCount: number,
): GridPosition | null {
  const next =
    key === "ArrowLeft" ? { row, col: col - 1 }
    : key === "ArrowRight" ? { row, col: col + 1 }
    : key === "ArrowUp" ? { row: row - 1, col }
    : key === "ArrowDown" ? { row: row + 1, col }
    : null;
  if (
    !next ||
    next.row < 0 ||
    next.row >= rowCount ||
    next.col < 0 ||
    next.col >= columnCount
  ) {
    return null;
  }
  return next;
}
