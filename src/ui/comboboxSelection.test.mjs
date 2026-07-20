import assert from "node:assert/strict";
import test from "node:test";
import { comboboxEnterValue } from "./comboboxSelection.ts";

test("untouched Enter keeps the current combobox value", () => {
  assert.equal(comboboxEnterValue("orders", "customers", false), "orders");
});

test("Enter selects the highlighted value after typing or keyboard navigation", () => {
  assert.equal(comboboxEnterValue("orders", "customers", true), "customers");
});
