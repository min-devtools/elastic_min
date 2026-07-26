import assert from "node:assert/strict";
import test from "node:test";
import { parseNodeRoles, summarizeNodesStats } from "./nodes.ts";

test("parseNodeRoles expands cat letters and keeps unknown ones visible", () => {
  assert.deepEqual(parseNodeRoles("dim"), ["data", "ingest", "master"]);
  assert.deepEqual(parseNodeRoles("-"), ["coordinating only"]);
  assert.deepEqual(parseNodeRoles(""), ["coordinating only"]);
  // a letter added in a future ES release must not vanish from the UI
  assert.deepEqual(parseNodeRoles("dz"), ["data", "z"]);
});

test("summarizeNodesStats sums heap, averages cpu, sums lifetime counters", () => {
  const sample = summarizeNodesStats(
    {
      nodes: {
        n1: {
          jvm: { mem: { heap_used_in_bytes: 100, heap_max_in_bytes: 400 } },
          os: { cpu: { percent: 10 } },
          indices: { indexing: { index_total: 1000 }, search: { query_total: 50 } },
        },
        n2: {
          jvm: { mem: { heap_used_in_bytes: 100, heap_max_in_bytes: 100 } },
          os: { cpu: { percent: 30 } },
          indices: { indexing: { index_total: 500 }, search: { query_total: 25 } },
        },
      },
    },
    1234,
  );
  assert.equal(sample.at, 1234);
  assert.equal(sample.heapPct, 40); // 200/500
  assert.equal(sample.cpuPct, 20); // avg(10, 30)
  assert.equal(sample.indexTotal, 1500);
  assert.equal(sample.searchTotal, 75);
});

test("summarizeNodesStats tolerates missing sections without inventing zeros", () => {
  const sample = summarizeNodesStats({ nodes: { n1: {} } }, 1);
  assert.equal(sample.heapPct, null);
  assert.equal(sample.cpuPct, null);
  assert.equal(sample.indexTotal, null);
  assert.equal(sample.searchTotal, null);
  const empty = summarizeNodesStats(null, 2);
  assert.equal(empty.heapPct, null);
});
