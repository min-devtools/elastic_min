import type { NodeMetricSample } from "./nodes";

/**
 * In-memory rolling history of node metric samples, one buffer per connection.
 * Lives for the app session only — sparklines fill up while a cluster is being
 * polled and reset on relaunch, which is the honest scope for a client-side chart.
 */
const CAP = 90; // 15 minutes at the 10s poll interval

const buffers = new Map<string, NodeMetricSample[]>();

/**
 * Append a sample and return the connection's history (new array reference on
 * change, so React deps can compare by identity). Re-delivery of the same poll
 * result (same `at`) is ignored.
 */
export function recordSample(connId: string, sample: NodeMetricSample): NodeMetricSample[] {
  const prev = buffers.get(connId) ?? [];
  if (prev.length && prev[prev.length - 1].at === sample.at) return prev;
  const next = [...prev, sample].slice(-CAP);
  buffers.set(connId, next);
  return next;
}

export function sampleHistory(connId: string): NodeMetricSample[] {
  return buffers.get(connId) ?? [];
}

/**
 * Per-second rates between consecutive samples of a lifetime counter
 * (indexing/search totals). Counter resets (node restart) clamp to 0 instead
 * of plotting a huge negative spike. Returns one value per gap.
 */
export function ratesPerSec(
  samples: NodeMetricSample[],
  key: "indexTotal" | "searchTotal",
): number[] {
  const out: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const dt = (b.at - a.at) / 1000;
    const av = a[key];
    const bv = b[key];
    if (dt <= 0 || av == null || bv == null) continue;
    out.push(Math.max(0, (bv - av) / dt));
  }
  return out;
}

/** Values of a gauge metric (heap/cpu) with nulls dropped, ready for a sparkline. */
export function gaugeSeries(
  samples: NodeMetricSample[],
  key: "heapPct" | "cpuPct",
): number[] {
  return samples.map((s) => s[key]).filter((v): v is number => v != null);
}
