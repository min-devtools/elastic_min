import type { EsHit } from "./types";
import { getPath } from "./format.ts";

/** RFC-4180 field escaping: quote when the value carries a comma, quote or newline. */
export function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return csvEscape(JSON.stringify(value));
  return csvEscape(String(value));
}

/**
 * Serialize hits to CSV. `columns` are dotted _source paths (the table's visible
 * columns); `_index` and `_id` are always prepended so rows stay addressable.
 */
export function hitsToCsv(hits: EsHit[], columns: string[]): string {
  const header = ["_index", "_id", ...columns].map(csvEscape).join(",");
  const lines = hits.map((h) =>
    [
      csvCell(h._index),
      csvCell(h._id),
      ...columns.map((c) => csvCell(getPath(h._source ?? {}, c))),
    ].join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

/** One hit per line: {_index, _id, _source} — greppable and _bulk-friendly. */
export function hitsToNdjson(hits: EsHit[]): string {
  return hits.map((h) => JSON.stringify({ _index: h._index, _id: h._id, _source: h._source ?? {} })).join("\n") + "\n";
}

/** Timestamped default filename for an export ("hits-2026-07-27-141530.csv"). */
export function exportFilename(prefix: string, ext: string, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${prefix}-${stamp}.${ext}`;
}
