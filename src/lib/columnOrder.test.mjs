import assert from "node:assert/strict";
import test from "node:test";
import { reorder, reorderVisible, syncColumnOrder } from "./columnOrder.ts";

test("reorder moves an item and leaves the original untouched", () => {
  const list = ["a", "b", "c", "d"];
  assert.deepEqual(reorder(list, 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(reorder(list, 3, 1), ["a", "d", "b", "c"]);
  assert.deepEqual(list, ["a", "b", "c", "d"]);
});

test("reorder returns the same reference on no-op or out-of-range", () => {
  const list = ["a", "b"];
  assert.equal(reorder(list, 1, 1), list);
  assert.equal(reorder(list, -1, 0), list);
  assert.equal(reorder(list, 0, 5), list);
});

test("reorderVisible maps header indices back past hidden columns", () => {
  const all = ["a", "hidden", "b", "c"];
  // headers render ["a", "b", "c"] — dragging header 2 ("c") onto header 0 ("a")
  assert.deepEqual(reorderVisible(all, ["a", "b", "c"], 2, 0), ["c", "a", "hidden", "b"]);
  // without the mapping this would have moved "b" instead
  assert.deepEqual(reorderVisible(all, ["a", "b", "c"], 0, 1), ["hidden", "b", "a", "c"]);
});

test("syncColumnOrder keeps user order, appends new columns, and preserves sparse fields", () => {
  assert.deepEqual(syncColumnOrder(["c", "a"], ["a", "b", "c"]), ["c", "a", "b"]);
  // A field missing from the current page/result sample can reappear later.
  // Do not silently remove the user's column while browsing paginated data.
  assert.deepEqual(syncColumnOrder(["c", "a"], ["a"]), ["c", "a"]);
});

test("syncColumnOrder returns prev by reference when nothing changed (guards a render loop)", () => {
  const prev = ["a", "b"];
  assert.equal(syncColumnOrder(prev, ["a", "b"]), prev);
  // the empty/empty case is the loop: `hits` is a fresh [] on every render while the query is idle
  const empty = [];
  assert.equal(syncColumnOrder(empty, []), empty);
});
