import assert from "node:assert/strict";
import test from "node:test";
import { THEMES } from "./themes.ts";

test("legacy dark/light IDs stay valid and map to the shared default themes", () => {
  assert.deepEqual(
    THEMES.filter(({ id }) => id === "dark" || id === "light"),
    [
      { id: "dark", label: "Bearded Arc", base: "dark" },
      { id: "light", label: "Min Light", base: "light" },
    ],
  );
});

test("store fallback theme id exists", () => {
  assert.ok(THEMES.some(({ id }) => id === "default-dark"));
});
