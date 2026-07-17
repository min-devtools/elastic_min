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
    useApp
      .getState()
      .showToast(
        "Settings storage unavailable",
        "Connections and saved queries won't be saved this session.",
        "err",
      );
  }

  // Session writes fire on every keystroke (queryTabs changes) — debounce the
  // serialize, and never let a quota error escape into the zustand subscriber.
  let sessionTimer: ReturnType<typeof setTimeout> | undefined;
  const writeSession = (): void => {
    const s = useApp.getState();
    try {
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
          docsTabCounter: s.docsTabCounter,
          docsTabs: s.docsTabs,
        }),
      );
    } catch (err) {
      console.error("failed to persist session", err);
    }
  };
  window.addEventListener("beforeunload", () => {
    clearTimeout(sessionTimer);
    writeSession();
  });

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
      s.docsTabs !== prev.docsTabs ||
      s.activeIndex !== prev.activeIndex
    ) {
      clearTimeout(sessionTimer);
      sessionTimer = setTimeout(writeSession, 500);
    }
    if (s.aiSessions !== prev.aiSessions || s.activeAiSessionId !== prev.activeAiSessionId) {
      try {
        localStorage.setItem(
          "elasticmin:ai-sessions",
          JSON.stringify({ sessions: s.aiSessions, activeSessionId: s.activeAiSessionId }),
        );
      } catch (err) {
        console.error("failed to persist AI chat sessions", err);
      }
    }
    prev = s;
  });
}
