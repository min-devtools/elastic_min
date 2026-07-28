/** Column reordering shared by the Documents and Search Results grids. */

/** Move `from` to `to` in a copy of `list`. Out-of-range or no-op returns `list` unchanged. */
export function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Reorder `all` using indices taken from `visible` — the rendered subset.
 * Table headers only render visible columns, so their indices don't line up
 * with the full ordered list once anything is hidden.
 */
export function reorderVisible(all: string[], visible: string[], from: number, to: number): string[] {
  return reorder(all, all.indexOf(visible[from]), all.indexOf(visible[to]));
}

/**
 * Keep the user's order and append columns the new result set introduced.
 *
 * A result page is only a sample of the index schema. Previously seen columns
 * must survive sparse pages so they do not vanish while the user is browsing.
 * Returns `prev` when nothing changed.
 */
export function syncColumnOrder(prev: string[], discovered: string[]): string[] {
  const add = discovered.filter((c) => !prev.includes(c));
  if (add.length === 0) return prev;
  return [...prev, ...add];
}
