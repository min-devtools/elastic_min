import assert from "node:assert/strict";
import test from "node:test";
import { activeQueryTabId, activeSubmitTarget } from "./activeQuery.ts";

test("run current query has no target outside a query tab", () => {
  assert.equal(activeQueryTabId({ id: "indexes", kind: "indexes" }), null);
  assert.equal(activeQueryTabId({ id: "docs-1", kind: "docs" }), null);
});

test("run current query targets the active query tab", () => {
  assert.equal(activeQueryTabId({ id: "query-1", kind: "query" }), "query-1");
});

test("Cmd+Enter routes by active tab kind", () => {
  assert.equal(activeSubmitTarget({ id: "query-1", kind: "query" }), "query");
  assert.equal(activeSubmitTarget({ id: "docs-1", kind: "docs" }), "docs");
  assert.equal(activeSubmitTarget({ id: "indexes", kind: "indexes" }), null);
});
