import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url); // src/

const read = (rel) => readFile(new URL(rel, root), "utf8");

test("shared Monaco JSON editor disables sticky scroll", async () => {
  const editor = await read("ui/JsonEditor.tsx");
  assert.match(editor, /stickyScroll:\s*\{\s*enabled:\s*false\s*\}/);
});

test("JSON response viewer renders through the shared read-only JsonEditor", async () => {
  const viewer = await read("ui/JsonResponseViewer.tsx");
  assert.match(viewer, /import \{ JsonEditor \}/);
  assert.match(viewer, /<JsonEditor[^>]*readOnly/);
});

test("JSON response viewer exposes path normalization (value.$ paths)", async () => {
  const viewer = await read("ui/JsonResponseViewer.tsx");
  assert.match(viewer, /normalizeJsonMany/);
  assert.match(viewer, /placeholder="value\.\$\.a or value\[0\]\.a"/);
});

test("results panel shows JSON via the response viewer", async () => {
  const panel = await read("components/views/ResultsPanel.tsx");
  assert.match(panel, /<JsonResponseViewer value=\{rawJson\}/);
});

test("results panel no longer has the NDJSON copy button", async () => {
  const panel = await read("components/views/ResultsPanel.tsx");
  assert.doesNotMatch(panel, /NDJSON/);
  assert.doesNotMatch(panel, /copyNdjson/);
});
