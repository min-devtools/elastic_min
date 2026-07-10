import { load, type Store } from "@tauri-apps/plugin-store";
import type { Connection, SavedQuery } from "./types";
import { useApp } from "../store";

let store: Store | null = null;

export async function initPersistence(): Promise<void> {
  try {
    store = await load("elasticmin.json", { autoSave: true, defaults: {} });
    const connections = (await store.get<Connection[]>("connections")) ?? [];
    const activeConnId = (await store.get<string | null>("activeConnId")) ?? null;
    const savedQueries = (await store.get<SavedQuery[]>("savedQueries")) ?? [];
    useApp.setState({
      connections,
      activeConnId: connections.some((c) => c.id === activeConnId) ? activeConnId : null,
      savedQueries,
    });
  } catch (err) {
    console.error("failed to load persisted store", err);
  }

  let prev = useApp.getState();
  useApp.subscribe((s) => {
    if (store) {
      if (s.connections !== prev.connections) void store.set("connections", s.connections);
      if (s.activeConnId !== prev.activeConnId) void store.set("activeConnId", s.activeConnId);
      if (s.savedQueries !== prev.savedQueries) void store.set("savedQueries", s.savedQueries);
    }
    // session restore: open tabs + editor contents (not results)
    if (
      s.tabs !== prev.tabs ||
      s.activeTabId !== prev.activeTabId ||
      s.queryTabs !== prev.queryTabs ||
      s.activeIndex !== prev.activeIndex
    ) {
      localStorage.setItem(
        "elasticmin:session",
        JSON.stringify({
          tabs: s.tabs,
          activeTabId: s.activeTabId,
          activeIndex: s.activeIndex,
          queryTabCounter: s.queryTabCounter,
          queryTabs: Object.fromEntries(
            Object.entries(s.queryTabs).map(([id, qt]) => [
              id,
              { method: qt.method, path: qt.path, body: qt.body },
            ]),
          ),
        }),
      );
    }
    prev = s;
  });
}
