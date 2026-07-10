import type { EsHit, QueryResult } from "./types";
import { esRequest } from "./es";
import { activeConnection, useApp } from "../store";

/** Execute the given query tab against the active connection. */
export async function runQueryTab(tabId: string): Promise<void> {
  const s = useApp.getState();
  const conn = activeConnection(s);
  const qt = s.queryTabs[tabId];
  if (!qt) return;
  if (!conn) {
    s.showToast("No connection", "Create and save a connection first.", "warn");
    s.openTab("connection");
    return;
  }
  s.updateQueryTab(tabId, { running: true });
  try {
    const res = await esRequest(conn, qt.method, qt.path, qt.body);
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
    useApp.getState().pushHistory({
      at: Date.now(),
      method: qt.method,
      path: qt.path,
      body: qt.body,
      status: res.status,
      timeMs: res.timeMs,
      hits: hits ? (total ?? hits.length) : null,
    });
    if (result.error) {
      useApp.getState().showToast("Request failed", result.error, "err");
    } else {
      useApp
        .getState()
        .showToast(
          "Request completed",
          `${qt.method} ${qt.path} returned ${hits ? `${hits.length} hits` : `HTTP ${res.status}`} in ${res.timeMs}ms.`,
        );
    }
  } catch (err) {
    useApp.getState().setQueryResult(tabId, {
      status: 0,
      timeMs: 0,
      hits: null,
      total: null,
      raw: null,
      error: String(err),
    });
    useApp.getState().showToast("Request failed", String(err), "err");
  } finally {
    useApp.getState().updateQueryTab(tabId, { running: false });
  }
}

/** Prompt-save the active query tab into Saved Queries (also renames the tab). */
export function saveActiveQuery(): void {
  const s = useApp.getState();
  const tab = s.tabs.find((t) => t.id === s.activeTabId);
  if (tab?.kind !== "query") {
    s.showToast("No query tab", "Focus a query tab to save it.", "warn");
    return;
  }
  const qt = s.queryTabs[tab.id];
  if (!qt) return;
  const name = window.prompt("Save query as:", tab.title);
  if (!name?.trim()) return;
  s.saveQuery({ name: name.trim(), method: qt.method, path: qt.path, body: qt.body });
  s.renameTab(tab.id, name.trim());
  s.showToast("Query saved", `"${name.trim()}" is available in the sidebar and ⌘K.`);
}

/** Run the query in the currently focused tab (or focus/create one). */
export function runActiveQuery(): void {
  const s = useApp.getState();
  const tab = s.tabs.find((t) => t.id === s.activeTabId);
  if (tab?.kind === "query") {
    void runQueryTab(tab.id);
    return;
  }
  const lastQuery = [...s.tabs].reverse().find((t) => t.kind === "query");
  if (lastQuery) {
    s.activateTab(lastQuery.id);
    void runQueryTab(lastQuery.id);
  } else {
    const id = s.newQueryTab();
    void runQueryTab(id);
  }
}
