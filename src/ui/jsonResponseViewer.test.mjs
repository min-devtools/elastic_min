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
  assert.match(viewer, /placeholder="hits\.hits\.\$\._source\.name or value\.\$\.a"/);
});

test("results panel shows JSON via the response viewer", async () => {
  const panel = await read("components/views/ResultsPanel.tsx");
  assert.match(panel, /<JsonResponseViewer value=\{rawJson\}/);
});

test("results panel no longer has the NDJSON copy-to-clipboard button", async () => {
  const panel = await read("components/views/ResultsPanel.tsx");
  // NDJSON leaves the app via file export only (hitsToNdjson → save_export),
  // never via the old clipboard copy button
  assert.doesNotMatch(panel, /copyNdjson/);
  assert.doesNotMatch(panel, /writeText\([^)]*[Nn]djson/);
});

test("results panel auto switches to JSON view when aggregations are present", async () => {
  const panel = await read("components/views/ResultsPanel.tsx");
  assert.match(panel, /"aggregations"\s*in\s*rawObj\s*\|\|\s*"aggs"\s*in\s*rawObj/);
  assert.match(panel, /setView\("json"\)/);
  // …and hands the view back once a plain result lands, but only if the switch was ours
  assert.match(panel, /autoJson\.current\s*=\s*true/);
  assert.match(panel, /else if \(autoJson\.current\)[\s\S]{0,80}setView\("table"\)/);
});

test("results panel does not remount Monaco to replay the reveal keyframe", async () => {
  const panel = await read("components/views/ResultsPanel.tsx");
  assert.match(panel, /className="result-editor-host"/);
  assert.doesNotMatch(panel, /result-editor-host[^\n]*result-reveal/);
});

test("results panel head ignores double-clicks aimed at its own controls", async () => {
  const panel = await read("components/views/ResultsPanel.tsx");
  assert.match(panel, /closest\("input, textarea, button, select, a"\)/);
});

test("query pane collapse persists a bare number restoreLayoutSizes can parse", async () => {
  const handles = await read("components/ResizeHandles.tsx");
  // Number("60px") is NaN, so a px-suffixed value silently drops the collapsed state
  assert.doesNotMatch(handles, /setItem\("elasticmin:query-top",\s*"\d+px"\)/);
  assert.match(handles, /setItem\("elasticmin:query-top",\s*String\(px\)\)/);
});

test("diff modal leaves mount/unmount to its caller's AnimatePresence", async () => {
  // a nested AnimatePresence shadows the caller's PresenceContext and kills the exit
  const modal = await read("components/DiffModal.tsx");
  assert.doesNotMatch(modal, /import \{[^}]*AnimatePresence/);
  assert.doesNotMatch(modal, /<AnimatePresence/);
  const inspector = await read("components/Inspector.tsx");
  assert.match(inspector, /<AnimatePresence>[\s\S]{0,80}diffOpen && selectedDoc/);
});

