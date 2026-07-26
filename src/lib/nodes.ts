/** Row shape of GET /_cat/nodes?format=json — all values arrive as strings or null. */
export interface CatNodeRow {
  id: string;
  name: string;
  ip: string | null;
  "node.role": string;
  master: string;
  version: string | null;
  cpu: string | null;
  "heap.percent": string | null;
  "ram.percent": string | null;
  "disk.total": string | null;
  "disk.used_percent": string | null;
  load_1m: string | null;
  uptime: string | null;
}

/** _cat/nodes role letters (ES 7/8). Unknown letters pass through verbatim. */
const ROLE_LETTERS: Record<string, string> = {
  c: "cold",
  d: "data",
  f: "frozen",
  h: "hot",
  i: "ingest",
  l: "ml",
  m: "master",
  r: "remote_cluster_client",
  s: "content",
  t: "transform",
  v: "voting_only",
  w: "warm",
};

/** Expand a _cat/nodes role string ("dim", "cdfhilmrstw", "-") into readable names. */
export function parseNodeRoles(roles: string): string[] {
  if (!roles || roles === "-") return ["coordinating only"];
  return [...roles].map((letter) => ROLE_LETTERS[letter] ?? letter);
}

/** One aggregated point of a cluster's node stats, used by the sparkline history. */
export interface NodeMetricSample {
  at: number;
  /** summed heap_used / summed heap_max across nodes, 0-100 */
  heapPct: number | null;
  /** average os.cpu.percent across nodes, 0-100 */
  cpuPct: number | null;
  /** lifetime counters summed across nodes — rates come from deltas */
  indexTotal: number | null;
  searchTotal: number | null;
}

/**
 * Collapse a GET /_nodes/stats/jvm,os,indices response into one sample.
 * Tolerates missing sections (a node can omit os.cpu on some platforms).
 */
export function summarizeNodesStats(json: unknown, at: number): NodeMetricSample {
  const nodes = (json as any)?.nodes ?? {};
  let heapUsed = 0;
  let heapMax = 0;
  let cpuSum = 0;
  let cpuCount = 0;
  let indexTotal = 0;
  let hasIndexTotal = false;
  let searchTotal = 0;
  let hasSearchTotal = false;
  for (const n of Object.values<any>(nodes)) {
    const mem = n?.jvm?.mem;
    if (typeof mem?.heap_used_in_bytes === "number" && typeof mem?.heap_max_in_bytes === "number") {
      heapUsed += mem.heap_used_in_bytes;
      heapMax += mem.heap_max_in_bytes;
    }
    const cpu = n?.os?.cpu?.percent;
    if (typeof cpu === "number") {
      cpuSum += cpu;
      cpuCount += 1;
    }
    const idx = n?.indices?.indexing?.index_total;
    if (typeof idx === "number") {
      indexTotal += idx;
      hasIndexTotal = true;
    }
    const search = n?.indices?.search?.query_total;
    if (typeof search === "number") {
      searchTotal += search;
      hasSearchTotal = true;
    }
  }
  return {
    at,
    heapPct: heapMax > 0 ? Math.round((heapUsed / heapMax) * 100) : null,
    cpuPct: cpuCount > 0 ? Math.round(cpuSum / cpuCount) : null,
    indexTotal: hasIndexTotal ? indexTotal : null,
    searchTotal: hasSearchTotal ? searchTotal : null,
  };
}
