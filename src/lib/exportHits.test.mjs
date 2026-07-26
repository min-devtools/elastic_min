import assert from "node:assert/strict";
import test from "node:test";
import { csvEscape, exportFilename, hitsToCsv, hitsToNdjson } from "./exportHits.ts";

const hit = (id, source) => ({ _index: "orders", _id: id, _score: 1, _source: source });

test("csvEscape quotes only when needed and doubles embedded quotes", () => {
  assert.equal(csvEscape("plain"), "plain");
  assert.equal(csvEscape("a,b"), '"a,b"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape("line\nbreak"), '"line\nbreak"');
});

test("hitsToCsv emits header + dotted-path cells, objects as JSON", () => {
  const csv = hitsToCsv(
    [hit("1", { customer: { name: "An, Bình" }, total: 99, tags: ["a", "b"] })],
    ["customer.name", "total", "tags", "missing"],
  );
  const [header, row, tail] = csv.split("\n");
  assert.equal(header, "_index,_id,customer.name,total,tags,missing");
  assert.equal(row, 'orders,1,"An, Bình",99,"[""a"",""b""]",');
  assert.equal(tail, "");
});

test("hitsToNdjson writes one self-contained JSON object per line", () => {
  const nd = hitsToNdjson([hit("1", { a: 1 }), hit("2", undefined)]);
  const lines = nd.trimEnd().split("\n");
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]), { _index: "orders", _id: "1", _source: { a: 1 } });
  assert.deepEqual(JSON.parse(lines[1]), { _index: "orders", _id: "2", _source: {} });
});

test("exportFilename stamps a sortable local timestamp", () => {
  const name = exportFilename("hits", "csv", new Date(2026, 6, 27, 9, 5, 3));
  assert.equal(name, "hits-2026-07-27-090503.csv");
});
