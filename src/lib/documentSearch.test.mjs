import assert from "node:assert/strict";
import test from "node:test";
import { nextDocumentSearch } from "./documentSearch.ts";

test("a changed Documents filter applies it and resets pagination", () => {
  assert.deepEqual(nextDocumentSearch("old", "new", 3), {
    applied: "new",
    page: 0,
    refetch: false,
  });
});

test("submitting the same Documents filter refetches only when already on page one", () => {
  assert.deepEqual(nextDocumentSearch("same", "same", 2), {
    applied: "same",
    page: 0,
    refetch: false,
  });
  assert.deepEqual(nextDocumentSearch("same", "same", 0), {
    applied: "same",
    page: 0,
    refetch: true,
  });
});
