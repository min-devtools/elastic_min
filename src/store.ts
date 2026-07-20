import { create } from "zustand";
import { isThemeId, themeBase } from "./lib/themes";
import { clampFontSize, DEFAULT_FONT_SIZE } from "./lib/fontScale";
import {
  AI_SESSION_CAP,
  appendAiEntry,
  createAiSession,
  deleteAiSession,
  loadAiSessionState,
  type AiChatEntry,
  type AiChatSession,
} from "./lib/aiSessions";
import type {
  Connection,
  DocsTabState,
  EsHit,
  HistoryEntry,
  QueryResult,
  QueryTabState,
  SavedQuery,
  TabDef,
  TabKind,
} from "./lib/types";

const TAB_META: Record<TabKind, { title: string; icon: TabDef["icon"]; iconClass: string }> = {
  welcome: { title: "Welcome", icon: "sparkles", iconClass: "soft-blue" },
  connection: { title: "New Connection", icon: "plug", iconClass: "soft-blue" },
  query: { title: "Query", icon: "query", iconClass: "soft-blue" },
  "quick-query": { title: "Quick Query", icon: "quick-query", iconClass: "soft-green" },
  docs: { title: "Documents", icon: "docs", iconClass: "soft-green" },
  indexes: { title: "All Indexes", icon: "indexes", iconClass: "soft-orange" },
  "create-index": { title: "Create Index", icon: "folder-plus", iconClass: "soft-green" },
  cluster: { title: "Cluster", icon: "cluster", iconClass: "soft-green" },
  mapping: { title: "Mapping", icon: "mapping", iconClass: "soft-blue" },
  settings: { title: "Settings", icon: "settings", iconClass: "soft-orange" },
  history: { title: "Query History", icon: "history", iconClass: "soft-orange" },
  "index-stats": { title: "Index Stats", icon: "activity", iconClass: "soft-green" },
  "saved-queries": { title: "Saved Queries", icon: "save", iconClass: "soft-blue" },
};

function docsTabTitle(index: string): string {
  return index ? `Documents · ${index}` : "Documents";
}

const HISTORY_CAP = 200;

function loadHistory(): HistoryEntry[] {
  try {
    const h = JSON.parse(localStorage.getItem("elasticmin:history") ?? "[]");
    if (!Array.isArray(h)) return [];
    return h
      .filter(
        (e: any) =>
          e &&
          typeof e.path === "string" &&
          typeof e.method === "string" &&
          typeof e.at === "number",
      )
      .slice(0, HISTORY_CAP);
  } catch {
    return [];
  }
}

const DEFAULT_QUERY_BODY = `{
  "size": 50,
  "query": {
    "match_all": {}
  }
}`;

/** Restore last session's open tabs from localStorage (results are not persisted). */
function loadSession(): {
  tabs: TabDef[];
  activeTabId: string;
  queryTabs: Record<string, QueryTabState>;
  queryTabCounter: number;
  docsTabs: Record<string, DocsTabState>;
  docsTabCounter: number;
  activeIndex: string | null;
} | null {
  try {
    const raw = localStorage.getItem("elasticmin:session");
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!Array.isArray(s.tabs) || s.tabs.length === 0) return null;
    const queryTabs: Record<string, QueryTabState> = {};
    for (const [id, qt] of Object.entries<any>(s.queryTabs ?? {})) {
      queryTabs[id] = {
        method: qt.method ?? "POST",
        path: qt.path ?? "/_search",
        body: qt.body ?? "",
        result: null,
        running: false,
      };
    }
    const docsTabs: Record<string, DocsTabState> = {};
    for (const [id, dt] of Object.entries<any>(s.docsTabs ?? {})) {
      docsTabs[id] = { index: typeof dt.index === "string" ? dt.index : "" };
    }
    const tabs: TabDef[] = s.tabs
      .filter(
        (t: TabDef) =>
          TAB_META[t.kind] &&
          (t.kind !== "query" || queryTabs[t.id]) &&
          (t.kind !== "docs" || docsTabs[t.id]),
      )
      .map((t: TabDef) => ({ ...t, icon: TAB_META[t.kind].icon, iconClass: TAB_META[t.kind].iconClass }));
    if (!tabs.length) return null;
    return {
      tabs,
      activeTabId: tabs.some((t) => t.id === s.activeTabId) ? s.activeTabId : tabs[0].id,
      queryTabs,
      queryTabCounter: Number(s.queryTabCounter) || 0,
      docsTabs,
      docsTabCounter: Number(s.docsTabCounter) || 0,
      activeIndex: typeof s.activeIndex === "string" ? s.activeIndex : null,
    };
  } catch {
    return null;
  }
}

const session = loadSession();
const aiSessionState = loadAiSessionState(localStorage.getItem("elasticmin:ai-sessions"));

export interface ToastMsg {
  title: string;
  body: string;
  kind?: "ok" | "warn" | "err";
}

export interface DialogRequest {
  kind: "prompt" | "confirm";
  title: string;
  message?: string;
  defaultValue?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface AppState {
  connections: Connection[];
  activeConnId: string | null;
  savedQueries: SavedQuery[];
  history: HistoryEntry[];
  aiSessions: AiChatSession[];
  activeAiSessionId: string;

  tabs: TabDef[];
  activeTabId: string;
  queryTabs: Record<string, QueryTabState>;
  queryTabCounter: number;
  docsTabs: Record<string, DocsTabState>;
  docsTabCounter: number;

  activeIndex: string | null;
  /** index names, most-recently-acted-on first — drives sidebar ordering */
  indexRecency: string[];
  selectedDoc: EsHit | null;
  /** inspector draft differs from the selected doc — guards against silent discard */
  inspectorDirty: boolean;
  /** table column the user clicked — highlighted in the inspector JSON */
  focusField: string | null;
  /** connection being edited in the Connection tab (null = new draft) */
  editingConnId: string | null;

  /** theme id from lib/themes ("default-dark" = Bearded Arc, or "light") */
  theme: string;
  compact: boolean;
  vimMode: boolean;
  editorFontSize: number;
  /** app-wide UI font size in px (1rem base) */
  uiFontSize: number;
  /** OpenAI-compatible provider for the AI query assistant */
  aiProvider: { endpoint: string; apiKey: string; model: string };
  /** UI font family ("" = design default) */
  uiFont: string;
  /** editor/mono font family ("" = design default) */
  editorFont: string;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  commandOpen: boolean;
  toast: ToastMsg | null;
  dialog: (DialogRequest & { resolve: (value: string | null) => void }) | null;

  // actions
  setConnections: (conns: Connection[]) => void;
  setSavedQueries: (qs: SavedQuery[]) => void;
  saveQuery: (q: Omit<SavedQuery, "id" | "createdAt">) => void;
  deleteSavedQuery: (id: string) => void;
  renameSavedQuery: (id: string, name: string) => void;
  pushHistory: (e: HistoryEntry) => void;
  clearHistory: () => void;
  newAiSession: () => string;
  setActiveAiSession: (id: string) => void;
  appendAiEntry: (sessionId: string, entry: AiChatEntry) => void;
  deleteAiSession: (id: string) => void;
  saveConnection: (conn: Connection) => void;
  deleteConnection: (id: string) => void;
  setActiveConn: (id: string | null) => void;

  openTab: (kind: TabKind) => void;
  newQueryTab: (init?: Partial<QueryTabState> & { title?: string }) => string;
  openDocsTab: (index?: string) => string;
  setDocsTabIndex: (id: string, index: string) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  reorderTab: (id: string, beforeId: string | null) => void;
  renameTab: (id: string, title: string) => void;
  updateQueryTab: (id: string, patch: Partial<QueryTabState>) => void;
  setQueryResult: (id: string, result: QueryResult | null) => void;

  setActiveIndex: (index: string | null) => void;
  bumpIndexRecency: (index: string) => void;
  selectDoc: (doc: EsHit | null, focusField?: string | null) => void;
  setInspectorDirty: (dirty: boolean) => void;
  setEditingConn: (id: string | null) => void;
  setTheme: (id: string) => void;

  toggleTheme: () => void;
  toggleCompact: () => void;
  toggleVim: () => void;
  setEditorFontSize: (size: number) => void;
  setUiFontSize: (size: number) => void;
  setUiFont: (font: string) => void;
  setAiProvider: (p: Partial<{ endpoint: string; apiKey: string; model: string }>) => void;
  setEditorFont: (font: string) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  setCommandOpen: (open: boolean) => void;
  showToast: (title: string, body: string, kind?: ToastMsg["kind"]) => void;
  clearToast: () => void;
  /** in-app replacement for window.prompt/confirm — those are unimplemented in the Tauri webview */
  openDialog: (req: DialogRequest) => Promise<string | null>;
}

let toastTimer: number | undefined;

export const activeConnection = (s: Pick<AppState, "connections" | "activeConnId">) =>
  s.connections.find((c) => c.id === s.activeConnId) ?? null;

export const inspectorAvailable = (s: Pick<AppState, "tabs" | "activeTabId">) => {
  const tab = s.tabs.find((t) => t.id === s.activeTabId);
  return tab?.kind === "query" || tab?.kind === "docs";
};

/** Select a doc in the inspector, confirming first when the current draft has unsaved edits. */
export async function selectDocWithConfirm(
  doc: EsHit | null,
  focusField: string | null = null,
): Promise<void> {
  const s = useApp.getState();
  if (s.inspectorDirty && doc !== s.selectedDoc) {
    const ok = await s.openDialog({
      kind: "confirm",
      title: "Discard edits?",
      message: "The inspector has unsaved changes to the current document.",
      confirmLabel: "Discard",
      danger: true,
    });
    if (ok === null) return;
  }
  useApp.getState().selectDoc(doc, focusField);
}

/** Close a tab, confirming first when it's a query tab with an edited, unsaved body. */
export async function closeTabWithConfirm(id: string): Promise<void> {
  const s = useApp.getState();
  const tab = s.tabs.find((t) => t.id === id);
  const qt = s.queryTabs[id];
  const dirty =
    tab?.kind === "query" &&
    qt &&
    qt.body.trim() !== DEFAULT_QUERY_BODY.trim() &&
    !s.savedQueries.some((sq) => sq.body === qt.body);
  if (dirty) {
    const ok = await s.openDialog({
      kind: "confirm",
      title: "Close tab?",
      message: `"${tab.title}" has an unsaved query. Close anyway?`,
      confirmLabel: "Close",
      danger: true,
    });
    if (ok === null) return;
  }
  useApp.getState().closeTab(id);
}

export const useApp = create<AppState>((set, get) => ({
  connections: [],
  activeConnId: null,
  savedQueries: [],
  history: loadHistory(),
  aiSessions: aiSessionState.sessions,
  activeAiSessionId: aiSessionState.activeSessionId,

  tabs: session?.tabs ?? [{ id: "welcome", kind: "welcome", ...TAB_META.welcome }],
  activeTabId: session?.activeTabId ?? "welcome",
  queryTabs: session?.queryTabs ?? {},
  queryTabCounter: session?.queryTabCounter ?? 0,
  docsTabs: session?.docsTabs ?? {},
  docsTabCounter: session?.docsTabCounter ?? 0,

  activeIndex: session?.activeIndex ?? null,
  indexRecency: [],
  selectedDoc: null,
  inspectorDirty: false,
  focusField: null,
  editingConnId: null,

  // default = Bearded Arc (shared with requests_min); removed/invalid stored themes fall back to it
  theme: (() => {
    const stored = localStorage.getItem("elasticmin:theme-v2") ?? localStorage.getItem("elasticmin:theme");
    return stored && isThemeId(stored) ? stored : "default-dark";
  })(),
  compact: localStorage.getItem("elasticmin:compact") === "1",
  vimMode: localStorage.getItem("elasticmin:vim") === "1",
  editorFontSize: Number(localStorage.getItem("elasticmin:font-size")) || 13,
  uiFontSize: clampFontSize(Number(localStorage.getItem("elasticmin:ui-font-size")) || DEFAULT_FONT_SIZE),
  aiProvider: (() => {
    try {
      return {
        endpoint: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-4o-mini",
        ...JSON.parse(localStorage.getItem("elasticmin:ai-provider") ?? "{}"),
      };
    } catch {
      return { endpoint: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini" };
    }
  })(),
  uiFont: localStorage.getItem("elasticmin:ui-font") ?? "",
  editorFont: localStorage.getItem("elasticmin:editor-font") ?? "",
  leftCollapsed: false,
  rightCollapsed: false,
  commandOpen: false,
  toast: null,
  dialog: null,

  setConnections: (conns) => set({ connections: conns }),
  setSavedQueries: (qs) => set({ savedQueries: qs }),
  saveQuery: (q) =>
    set((s) => {
      // same name overwrites (update-in-place keeps ordering)
      const existing = s.savedQueries.find((x) => x.name === q.name);
      const savedQueries = existing
        ? s.savedQueries.map((x) => (x.id === existing.id ? { ...existing, ...q } : x))
        : [...s.savedQueries, { ...q, id: crypto.randomUUID(), createdAt: Date.now() }];
      return { savedQueries };
    }),
  deleteSavedQuery: (id) =>
    set((s) => ({ savedQueries: s.savedQueries.filter((q) => q.id !== id) })),
  renameSavedQuery: (id, name) =>
    set((s) => ({
      savedQueries: s.savedQueries.map((q) =>
        q.id === id ? { ...q, name: name.trim() || q.name } : q,
      ),
    })),
  pushHistory: (e) =>
    set((s) => {
      const history = [e, ...s.history].slice(0, HISTORY_CAP);
      try {
        localStorage.setItem("elasticmin:history", JSON.stringify(history));
      } catch (err) {
        console.error("failed to persist history", err);
      }
      return { history };
    }),
  clearHistory: () => {
    localStorage.removeItem("elasticmin:history");
    set({ history: [] });
  },
  newAiSession: () => {
    const chat = createAiSession();
    set((s) => ({
      aiSessions: [chat, ...s.aiSessions].slice(0, AI_SESSION_CAP),
      activeAiSessionId: chat.id,
    }));
    return chat.id;
  },
  setActiveAiSession: (id) =>
    set((s) =>
      s.aiSessions.some((chat) => chat.id === id) ? { activeAiSessionId: id } : s,
    ),
  appendAiEntry: (sessionId, entry) =>
    set((s) => ({ aiSessions: appendAiEntry(s.aiSessions, sessionId, entry) })),
  deleteAiSession: (id) =>
    set((s) => {
      const next = deleteAiSession(s.aiSessions, id, s.activeAiSessionId);
      return { aiSessions: next.sessions, activeAiSessionId: next.activeSessionId };
    }),
  saveConnection: (conn) =>
    set((s) => {
      const existing = s.connections.findIndex((c) => c.id === conn.id);
      const connections =
        existing >= 0
          ? s.connections.map((c) => (c.id === conn.id ? conn : c))
          : [...s.connections, conn];
      return { connections };
    }),
  deleteConnection: (id) =>
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
      activeConnId: s.activeConnId === id ? null : s.activeConnId,
    })),
  setActiveConn: (id) => set({ activeConnId: id, selectedDoc: null }),

  openTab: (kind) => {
    const s = get();
    if (kind === "query") {
      // focus the most recent query tab, or create one
      const existing = [...s.tabs].reverse().find((t) => t.kind === "query");
      if (existing) return set({ activeTabId: existing.id });
      get().newQueryTab();
      return;
    }
    if (kind === "docs") {
      // docs tabs are multi-instance (one per index) — route through openDocsTab
      get().openDocsTab();
      return;
    }
    const existing = s.tabs.find((t) => t.kind === kind);
    if (existing) return set({ activeTabId: existing.id });
    set({
      tabs: [...s.tabs, { id: kind, kind, ...TAB_META[kind] }],
      activeTabId: kind,
    });
  },

  newQueryTab: (init) => {
    const s = get();
    const n = s.queryTabCounter + 1;
    const id = `query-${n}`;
    const conn = activeConnection(s);
    const index = s.activeIndex ?? conn?.defaultIndex ?? "";
    const { title: initTitle, ...queryInit } = init ?? {};
    set({
      queryTabCounter: n,
      tabs: [
        ...s.tabs,
        { id, kind: "query", ...TAB_META.query, title: initTitle ?? (n === 1 ? "Query" : `Query ${n}`) },
      ],
      activeTabId: id,
      queryTabs: {
        ...s.queryTabs,
        [id]: {
          method: "POST",
          path: index ? `/${index}/_search` : "/_search",
          body: DEFAULT_QUERY_BODY,
          result: null,
          running: false,
          ...queryInit,
        },
      },
    });
    return id;
  },

  openDocsTab: (index) => {
    const s = get();
    const conn = activeConnection(s);
    const idx = index ?? s.activeIndex ?? conn?.defaultIndex ?? "";
    if (idx) get().bumpIndexRecency(idx);
    const existingId = s.tabs.find((t) => t.kind === "docs" && s.docsTabs[t.id]?.index === idx)?.id;
    if (existingId) {
      set({ activeTabId: existingId });
      return existingId;
    }
    const n = s.docsTabCounter + 1;
    const id = `docs-${n}`;
    set({
      docsTabCounter: n,
      tabs: [...s.tabs, { id, kind: "docs", ...TAB_META.docs, title: docsTabTitle(idx) }],
      activeTabId: id,
      docsTabs: { ...s.docsTabs, [id]: { index: idx } },
    });
    return id;
  },

  setDocsTabIndex: (id, index) =>
    set((s) =>
      s.docsTabs[id]
        ? {
            docsTabs: { ...s.docsTabs, [id]: { index } },
            tabs: s.tabs.map((t) => (t.id === id ? { ...t, title: docsTabTitle(index) } : t)),
          }
        : s,
    ),

  closeTab: (id) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      if (idx < 0) return s;
      const tabs = s.tabs.filter((t) => t.id !== id);
      const queryTabs = { ...s.queryTabs };
      delete queryTabs[id];
      const docsTabs = { ...s.docsTabs };
      delete docsTabs[id];
      // renumber from 1 again once the last tab of a kind closes, instead of counting up forever
      const queryTabCounter = tabs.some((t) => t.kind === "query") ? s.queryTabCounter : 0;
      const docsTabCounter = tabs.some((t) => t.kind === "docs") ? s.docsTabCounter : 0;
      let activeTabId = s.activeTabId;
      if (activeTabId === id) {
        const next = tabs[Math.min(idx, tabs.length - 1)];
        activeTabId = next?.id ?? "";
      }
      if (tabs.length === 0) {
        return {
          tabs: [{ id: "welcome", kind: "welcome", ...TAB_META.welcome }],
          activeTabId: "welcome",
          queryTabs,
          docsTabs,
          queryTabCounter,
          docsTabCounter,
        };
      }
      return { tabs, activeTabId, queryTabs, docsTabs, queryTabCounter, docsTabCounter };
    }),

  activateTab: (id) => set({ activeTabId: id }),

  reorderTab: (id, beforeId) =>
    set((s) => {
      if (id === beforeId) return s;
      const dragged = s.tabs.find((t) => t.id === id);
      if (!dragged) return s;
      const rest = s.tabs.filter((t) => t.id !== id);
      const idx = beforeId ? rest.findIndex((t) => t.id === beforeId) : -1;
      const tabs = idx < 0 ? [...rest, dragged] : [...rest.slice(0, idx), dragged, ...rest.slice(idx)];
      return { tabs };
    }),

  renameTab: (id, title) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, title: title.trim() || t.title } : t,
      ),
    })),

  updateQueryTab: (id, patch) =>
    set((s) =>
      s.queryTabs[id]
        ? { queryTabs: { ...s.queryTabs, [id]: { ...s.queryTabs[id], ...patch } } }
        : s,
    ),

  setQueryResult: (id, result) =>
    set((s) =>
      s.queryTabs[id]
        ? { queryTabs: { ...s.queryTabs, [id]: { ...s.queryTabs[id], result } } }
        : s,
    ),

  setActiveIndex: (index) => set({ activeIndex: index }),
  bumpIndexRecency: (index) =>
    set((s) => ({ indexRecency: [index, ...s.indexRecency.filter((i) => i !== index)] })),
  // auto show/hide the right-dock inspector with what's selected — nothing selected, nothing to show
  selectDoc: (doc, focusField = null) =>
    set({ selectedDoc: doc, focusField, inspectorDirty: false, rightCollapsed: doc === null }),
  setInspectorDirty: (dirty) => set({ inspectorDirty: dirty }),
  setEditingConn: (id) => set({ editingConnId: id }),
  setTheme: (id) => {
    localStorage.setItem("elasticmin:theme-v2", id);
    set({ theme: id });
  },

  toggleTheme: () =>
    set((s) => {
      // flip between light/dark base regardless of the current custom theme
      const theme = themeBase(s.theme) === "dark" ? "light" : "dark";
      localStorage.setItem("elasticmin:theme-v2", theme);
      return { theme };
    }),
  toggleCompact: () =>
    set((s) => {
      localStorage.setItem("elasticmin:compact", s.compact ? "0" : "1");
      return { compact: !s.compact };
    }),
  toggleVim: () =>
    set((s) => {
      localStorage.setItem("elasticmin:vim", s.vimMode ? "0" : "1");
      return { vimMode: !s.vimMode };
    }),
  setEditorFontSize: (size) => {
    const clamped = Math.min(22, Math.max(10, size || 13));
    localStorage.setItem("elasticmin:font-size", String(clamped));
    set({ editorFontSize: clamped });
  },
  setUiFontSize: (size) => {
    const clamped = clampFontSize(size || DEFAULT_FONT_SIZE);
    localStorage.setItem("elasticmin:ui-font-size", String(clamped));
    set({ uiFontSize: clamped });
  },
  setAiProvider: (p) =>
    set((s) => {
      const aiProvider = { ...s.aiProvider, ...p };
      localStorage.setItem("elasticmin:ai-provider", JSON.stringify(aiProvider));
      return { aiProvider };
    }),
  setUiFont: (font) => {
    localStorage.setItem("elasticmin:ui-font", font);
    set({ uiFont: font });
  },
  setEditorFont: (font) => {
    localStorage.setItem("elasticmin:editor-font", font);
    set({ editorFont: font });
  },
  toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRight: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
  setCommandOpen: (open) => set({ commandOpen: open }),

  showToast: (title, body, kind) => {
    window.clearTimeout(toastTimer);
    set({ toast: { title, body, kind } });
    // errors stay until dismissed — ES error reasons need time to read/copy
    if (kind !== "err") {
      toastTimer = window.setTimeout(() => set({ toast: null }), 2600);
    }
  },
  clearToast: () => {
    window.clearTimeout(toastTimer);
    set({ toast: null });
  },

  openDialog: (req) =>
    new Promise<string | null>((resolve) => {
      set({
        dialog: {
          ...req,
          resolve: (value) => {
            resolve(value);
            set({ dialog: null });
          },
        },
      });
    }),
}));
