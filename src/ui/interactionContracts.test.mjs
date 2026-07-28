import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFile(new URL(rel, root), "utf8");

test("sortable headers suppress the click emitted after a drag", async () => {
  const sortTh = await read("ui/SortTh.tsx");
  assert.match(sortTh, /dragStarted\.current\s*=\s*true/);
  assert.match(sortTh, /if\s*\(dragStarted\.current\)/);
});

test("documents table state and placeholder data are scoped to connection and index", async () => {
  const docs = await read("components/views/DocsView.tsx");
  assert.match(docs, /\[conn\?\.id,\s*index\]/);
  assert.match(docs, /dataScope/);
  assert.match(docs, /search\.data\?\.scope\s*===\s*dataScope/);
});

test("global Run action is disabled outside a runnable query tab", async () => {
  const titlebar = await read("components/Titlebar.tsx");
  assert.match(
    titlebar,
    /aria-label="Run current query"[^>]*disabled=\{activeTabKind !== "query" \|\| !conn \|\| running\}/,
  );
});

test("connection shortcuts act only on the focused connection row", async () => {
  const sidebar = await read("components/Sidebar.tsx");
  assert.match(sidebar, /data-connection-id=\{c\.id\}/);
  assert.match(sidebar, /closest<HTMLElement>\("\[data-connection-id\]"\)/);
  assert.doesNotMatch(sidebar, /if \(!activeConnId\) return/);
  assert.match(sidebar, /connections\.some\(\(connection\) => connection\.id === focusedConnId\)/);
  assert.doesNotMatch(sidebar, /duplicateConn\(activeConnId\)/);
  assert.doesNotMatch(sidebar, /confirmDeleteConnection\(activeConnId\)/);
});

test("context menus expose real keyboard-focusable menu items", async () => {
  const menu = await read("ui/ContextMenu.tsx");
  assert.match(menu, /role="menu"/);
  assert.match(menu, /role="menuitem"/);
  assert.match(menu, /<button/);
  assert.match(menu, /ArrowDown/);
  assert.match(menu, /ArrowUp/);
});

test("column visibility buttons describe the affected column", async () => {
  const controls = await read("ui/ColumnControls.tsx");
  assert.match(controls, /aria-label=\{`\$\{visible \? "Hide" : "Show"\} \$\{c\} column`\}/);
});

test("table cells use a dedicated copy action instead of overlapping double-click behavior", async () => {
  for (const file of ["components/views/DocsView.tsx", "components/views/ResultsPanel.tsx"]) {
    const view = await read(file);
    assert.doesNotMatch(view, /title="Click: inspect · double-click: copy value"/);
    assert.match(view, /className="cell-copy"/);
    assert.match(view, /aria-label=\{`Copy \$\{c\} value`\}/);
    assert.match(view, /nextGridPosition/);
    assert.match(view, /resolveTabbableGridPosition/);
    assert.match(view, /data-copy-cell=\{cellKey\}/);
    assert.match(view, /tabIndex=\{copyTabbable \? 0 : -1\}/);
  }
});

test("Hide all includes sparse columns preserved from earlier pages", async () => {
  for (const file of ["components/views/DocsView.tsx", "components/views/ResultsPanel.tsx"]) {
    const view = await read(file);
    assert.match(view, /const hideAllColumns = \(\) => setHiddenColumns\(new Set\(columnOrder\)\)/);
  }
});
