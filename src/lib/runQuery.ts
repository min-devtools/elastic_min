import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { EsHit, QueryResult } from "./types";
import { esRequest } from "./es";
import { activeConnection, useApp } from "../store";
import { activeQueryTabId } from "./activeQuery";

// Monotonic run token per tab: a response only lands if it belongs to the
// latest run, so cancelled/superseded requests can't overwrite newer results.
const runSeq = new Map<string, number>();

/** Cancel the in-flight run for a tab: its response will be dropped when it lands. */
export function cancelQueryRun(tabId: string): void {
  runSeq.set(tabId, (runSeq.get(tabId) ?? 0) + 1);
  useApp.getState().updateQueryTab(tabId, { running: false });
}

/** Execute the given query tab against the active connection. */
export async function runQueryTab(tabId: string): Promise<void> {
  const s = useApp.getState();
  const conn = activeConnection(s);
  const qt = s.queryTabs[tabId];
  if (!qt || qt.running) return;
  if (!conn) {
    s.showToast("No connection", "Create and save a connection first.", "warn");
    s.openTab("connection");
    return;
  }
  const seq = (runSeq.get(tabId) ?? 0) + 1;
  runSeq.set(tabId, seq);
  s.updateQueryTab(tabId, { running: true });
  let res;
  try {
    res = await esRequest(conn, qt.method, qt.path, qt.body);
  } catch (err) {
    if (runSeq.get(tabId) !== seq) return; // cancelled or superseded
    useApp.getState().setQueryResult(tabId, {
      status: 0,
      timeMs: 0,
      hits: null,
      total: null,
      raw: null,
      error: String(err),
    });
    useApp.getState().showToast("Request failed", String(err), "err");
    useApp.getState().updateQueryTab(tabId, { running: false });
    return;
  }
  if (runSeq.get(tabId) !== seq) return; // cancelled or superseded
  const json = res.json as any;
  const hits: EsHit[] | null = Array.isArray(json?.hits?.hits) ? json.hits.hits : null;
  const total =
    typeof json?.hits?.total === "number"
      ? json.hits.total
      : (json?.hits?.total?.value as number | undefined) ?? null;
  const result: QueryResult = {
    status: res.status,
    timeMs: res.timeMs,
    hits,
    total,
    raw: res.json ?? res.raw,
    error:
      res.status >= 400
        ? json?.error?.reason || json?.error?.type || `HTTP ${res.status}`
        : undefined,
  };
  useApp.getState().setQueryResult(tabId, result);
  useApp.getState().updateQueryTab(tabId, { running: false });
  // recency: bump the queried index only on a successful run, not on sidebar click
  if (!result.error) {
    const seg = qt.path.split("?")[0].split("/").filter(Boolean)[0];
    if (seg && !seg.startsWith("_")) useApp.getState().bumpIndexRecency(seg);
  }
  useApp.getState().pushHistory({
    at: Date.now(),
    method: qt.method,
    path: qt.path,
    body: qt.body,
    status: res.status,
    timeMs: res.timeMs,
    hits: hits ? (total ?? hits.length) : null,
    connId: conn.id,
    connName: conn.name,
  });
  if (result.error) {
    useApp.getState().showToast("Request failed", result.error, "err");
  }
}

/** Copy the focused query tab as a curl command (auth omitted — add your own credentials). */
export async function copyActiveQueryAsCurl(): Promise<void> {
  const s = useApp.getState();
  const tab = s.tabs.find((t) => t.id === s.activeTabId);
  const qt = tab?.kind === "query" ? s.queryTabs[tab.id] : undefined;
  if (!qt) {
    s.showToast("No query tab", "Focus a query tab to copy it as curl.", "warn");
    return;
  }
  const conn = activeConnection(s);
  const endpoint = (conn?.endpoint ?? "http://localhost:9200").replace(/\/$/, "");
  const parts = [`curl -X ${qt.method} '${endpoint}${qt.path}'`];
  if (qt.body.trim()) {
    const contentType = /\/_bulk(\?|$)/.test(qt.path)
      ? "application/x-ndjson"
      : "application/json";
    parts.push(`-H 'Content-Type: ${contentType}'`);
    parts.push(`-d '${qt.body.replace(/'/g, `'\\''`)}'`);
  }
  await writeText(parts.join(" \\\n  "));
  s.showToast("Copied as curl", "Credentials are not included in the command.");
}

/** Prompt-save the active query tab into Saved Queries (also renames the tab). */
export async function saveActiveQuery(): Promise<void> {
  const s = useApp.getState();
  const tab = s.tabs.find((t) => t.id === s.activeTabId);
  if (tab?.kind !== "query") {
    s.showToast("No query tab", "Focus a query tab to save it.", "warn");
    return;
  }
  const qt = s.queryTabs[tab.id];
  if (!qt) return;
  const name = await s.openDialog({
    kind: "prompt",
    title: "Save query",
    message: "Save query as:",
    defaultValue: tab.title,
    confirmLabel: "Save",
  });
  if (!name?.trim()) return;
  s.saveQuery({ name: name.trim(), method: qt.method, path: qt.path, body: qt.body });
  s.renameTab(tab.id, name.trim());
  s.showToast("Query saved", `"${name.trim()}" is available in the sidebar and ⌘K.`);
}

/** Run the query in the currently focused query tab. */
export function runActiveQuery(): void {
  const s = useApp.getState();
  const tab = s.tabs.find((t) => t.id === s.activeTabId);
  const tabId = activeQueryTabId(tab);
  if (tabId) void runQueryTab(tabId);
}
