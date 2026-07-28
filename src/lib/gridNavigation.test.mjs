import assert from "node:assert/strict";
import test from "node:test";
import { nextGridPosition, resolveTabbableGridPosition } from "./gridNavigation.ts";

test("grid arrow navigation moves within bounds", () => {
  assert.deepEqual(nextGridPosition(1, 1, "ArrowRight", 3, 4), { row: 1, col: 2 });
  assert.deepEqual(nextGridPosition(1, 1, "ArrowLeft", 3, 4), { row: 1, col: 0 });
  assert.deepEqual(nextGridPosition(1, 1, "ArrowDown", 3, 4), { row: 2, col: 1 });
  assert.deepEqual(nextGridPosition(1, 1, "ArrowUp", 3, 4), { row: 0, col: 1 });
});

test("grid arrow navigation stops at edges and ignores other keys", () => {
  assert.equal(nextGridPosition(0, 0, "ArrowLeft", 3, 4), null);
  assert.equal(nextGridPosition(0, 0, "ArrowUp", 3, 4), null);
  assert.equal(nextGridPosition(2, 3, "ArrowRight", 3, 4), null);
  assert.equal(nextGridPosition(2, 3, "ArrowDown", 3, 4), null);
  assert.equal(nextGridPosition(0, 0, "Enter", 3, 4), null);
});

test("grid exposes exactly one active, selected, or default tab stop", () => {
  assert.deepEqual(
    resolveTabbableGridPosition({ row: 2, col: 3 }, { row: 1, col: 1 }, 4, 5),
    { row: 2, col: 3 },
  );
  assert.deepEqual(
    resolveTabbableGridPosition({ row: 9, col: 9 }, { row: 1, col: 1 }, 4, 5),
    { row: 1, col: 1 },
  );
  assert.deepEqual(resolveTabbableGridPosition(null, null, 4, 5), { row: 0, col: 0 });
  assert.equal(resolveTabbableGridPosition(null, null, 0, 5), null);
});
