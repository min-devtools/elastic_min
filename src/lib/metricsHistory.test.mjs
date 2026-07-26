import assert from "node:assert/strict";
import test from "node:test";
import { gaugeSeries, ratesPerSec, recordSample, sampleHistory } from "./metricsHistory.ts";

const sample = (at, over = {}) => ({
  at,
  heapPct: 50,
  cpuPct: 10,
  indexTotal: 0,
  searchTotal: 0,
  ...over,
});

test("recordSample appends, dedupes same-timestamp redelivery, caps the buffer", () => {
  const id = "conn-append";
  const first = recordSample(id, sample(1000));
  assert.equal(first.length, 1);
  // react-query can hand the same result to two subscribers — no double points
  const deduped = recordSample(id, sample(1000));
  assert.equal(deduped, first);
  recordSample(id, sample(2000));
  assert.equal(sampleHistory(id).length, 2);
  for (let i = 0; i < 200; i++) recordSample(id, sample(3000 + i));
  assert.ok(sampleHistory(id).length <= 90, "buffer must stay capped");
  // oldest samples fall off the front
  assert.ok(sampleHistory(id)[0].at > 1000);
});

test("ratesPerSec derives per-second deltas and clamps counter resets to 0", () => {
  const samples = [
    sample(0, { indexTotal: 100 }),
    sample(10_000, { indexTotal: 200 }), // +100 over 10s = 10/s
    sample(20_000, { indexTotal: 50 }), // node restart — counter went backwards
    sample(30_000, { indexTotal: null }), // section missing on one poll
    sample(40_000, { indexTotal: 60 }),
  ];
  assert.deepEqual(ratesPerSec(samples, "indexTotal"), [10, 0]);
});

test("gaugeSeries drops null points instead of plotting them as zero", () => {
  const samples = [sample(0, { heapPct: 40 }), sample(1, { heapPct: null }), sample(2, { heapPct: 60 })];
  assert.deepEqual(gaugeSeries(samples, "heapPct"), [40, 60]);
});
