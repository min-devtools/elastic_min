import { create } from "zustand";
import { themeBase } from "./lib/themes";
import type {
  Connection,
  EsHit,
  HistoryEntry,
  QueryResult,
  QueryTabState,
  SavedQuery,
  TabDef,
  TabKind,
} from "./lib/types";

const TAB_META: Record<TabKind, { title: string; icon: string; iconClass: string }> = {
  welcome: { title: "Welcome", icon: "◆", iconClass: "soft-blue" },
  connection: { title: "New Connection", icon: "＋", iconClass: "soft-blue" },
  query: { title: "Query", icon: "⌁", iconClass: "soft-blue" },
  "quick-query": { title: "Quick Query", icon: "⌕", iconClass: "soft-green" },
  docs: { title: "Documents", icon: "▤", iconClass: "soft-green" },
  indexes: { title: "All Indexes", icon: "◧", iconClass: "soft-orange" },
  "create-index": { title: "Create Index", icon: "＋", iconClass: "soft-green" },
  cluster: { title: "Cluster", icon: "◌", iconClass: "soft-green" },
  mapping: { title: "Mapping", icon: "⌬", iconClass: "soft-blue" },
  settings: { title: "Settings", icon: "⚙", iconClass: "soft-orange" },
  history: { title: "Query History", icon: "↺", iconClass: "soft-orange" },
  "index-stats": { title: "Index Stats", icon: "∿", iconClass: "soft-green" },
};

const HISTORY_CAP = 200;

function loadHistory(): HistoryEntry[] {
  try {
    const h = JSON.parse(localStorage.getItem("elasticmin:history") ?? "[]");
    return Array.isArray(h) ? h.slice(0, HISTORY_CAP) : [];
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
    const tabs: TabDef[] = s.tabs.filter(
      (t: TabDef) => TAB_META[t.kind] && (t.kind !== "query" || queryTabs[t.id]),
    );
    if (!tabs.length) return null;
    return {
      tabs,
      activeTabId: tabs.some((t) => t.id === s.activeTabId) ? s.activeTabId : tabs[0].id,
      queryTabs,
      queryTabCounter: Number(s.queryTabCounter) || 0,
      activeIndex: typeof s.activeIndex === "string" ? s.activeIndex : null,
    };
  } catch {
    return null;
  }
}

const session = loadSession();

export interface ToastMsg {
  title: string;
  body: string;
  kind?: "ok" | "warn" | "err";
}

interface AppState {
  connections: Connection[];
  activeConnId: string | null;
  savedQueries: SavedQuery[];
  history: HistoryEntry[];

  tabs: TabDef[];
  activeTabId: string;
  queryTabs: Record<string, QueryTabState>;
  queryTabCounter: number;

  activeIndex: string | null;
  selectedDoc: EsHit | null;
  /** table column the user clicked — highlighted in the inspector JSON */
  focusField: string | null;
  /** connection being edited in the Connection tab (null = new draft) */
  editingConnId: string | null;

  /** theme id from lib/themes (e.g. "dark", "light", "tokyo-night") */
  theme: string;
  compact: boolean;
  vimMode: boolean;
  editorFontSize: number;
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

  // actions
  setConnections: (conns: Connection[]) => void;
  setSavedQueries: (qs: SavedQuery[]) => void;
  saveQuery: (q: Omit<SavedQuery, "id" | "createdAt">) => void;
  deleteSavedQuery: (id: string) => void;
  renameSavedQuery: (id: string, name: string) => void;
  pushHistory: (e: HistoryEntry) => void;
  clearHistory: () => void;
  saveConnection: (conn: Connection) => void;
  deleteConnection: (id: string) => void;
  setActiveConn: (id: string | null) => void;

  openTab: (kind: TabKind) => void;
  newQueryTab: (init?: Partial<QueryTabState>) => string;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;
  updateQueryTab: (id: string, patch: Partial<QueryTabState>) => void;
  setQueryResult: (id: string, result: QueryResult | null) => void;

  setActiveIndex: (index: string | null) => void;
  selectDoc: (doc: EsHit | null, focusField?: string | null) => void;
  setEditingConn: (id: string | null) => void;
  setTheme: (id: string) => void;

  toggleTheme: () => void;
  toggleCompact: () => void;
  toggleVim: () => void;
  setEditorFontSize: (size: number) => void;
  setUiFont: (font: string) => void;
  setAiProvider: (p: Partial<{ endpoint: string; apiKey: string; model: string }>) => void;
  setEditorFont: (font: string) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  setCommandOpen: (open: boolean) => void;
  showToast: (title: string, body: string, kind?: ToastMsg["kind"]) => void;
  clearToast: () => void;
}

let toastTimer: number | undefined;

export const activeConnection = (s: Pick<AppState, "connections" | "activeConnId">) =>
  s.connections.find((c) => c.id === s.activeConnId) ?? null;

export const inspectorAvailable = (s: Pick<AppState, "tabs" | "activeTabId">) => {
  const tab = s.tabs.find((t) => t.id === s.activeTabId);
  return tab?.kind === "query" || tab?.kind === "docs";
};

export const useApp = create<AppState>((set, get) => ({
  connections: [],
  activeConnId: null,
  savedQueries: [],
  history: loadHistory(),

  tabs: session?.tabs ?? [{ id: "welcome", kind: "welcome", ...TAB_META.welcome }],
  activeTabId: session?.activeTabId ?? "welcome",
  queryTabs: session?.queryTabs ?? {},
  queryTabCounter: session?.queryTabCounter ?? 0,

  activeIndex: session?.activeIndex ?? null,
  selectedDoc: null,
  focusField: null,
  editingConnId: null,

  theme: localStorage.getItem("elasticmin:theme") || "dark",
  compact: localStorage.getItem("elasticmin:compact") === "1",
  vimMode: localStorage.getItem("elasticmin:vim") === "1",
  editorFontSize: Number(localStorage.getItem("elasticmin:font-size")) || 13,
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
      localStorage.setItem("elasticmin:history", JSON.stringify(history));
      return { history };
    }),
  clearHistory: () => {
    localStorage.removeItem("elasticmin:history");
    set({ history: [] });
  },
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
    set({
      queryTabCounter: n,
      tabs: [
        ...s.tabs,
        { id, kind: "query", ...TAB_META.query, title: n === 1 ? "Query" : `Query ${n}` },
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
          ...init,
        },
      },
    });
    return id;
  },

  closeTab: (id) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      if (idx < 0) return s;
      const tabs = s.tabs.filter((t) => t.id !== id);
      const queryTabs = { ...s.queryTabs };
      delete queryTabs[id];
      let activeTabId = s.activeTabId;
      if (activeTabId === id) {
        const next = tabs[Math.min(idx, tabs.length - 1)];
        activeTabId = next?.id ?? "";
      }
      if (tabs.length === 0) {
        return { tabs: [{ id: "welcome", kind: "welcome", ...TAB_META.welcome }], activeTabId: "welcome", queryTabs };
      }
      return { tabs, activeTabId, queryTabs };
    }),

  activateTab: (id) => set({ activeTabId: id }),

  renameTab: (id, title) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, title: title.trim() || t.title } : t,
      ),
    })),

  updateQueryTab: (id, patch) =>
    set((s) => ({
      queryTabs: { ...s.queryTabs, [id]: { ...s.queryTabs[id], ...patch } },
    })),

  setQueryResult: (id, result) =>
    set((s) =>
      s.queryTabs[id]
        ? { queryTabs: { ...s.queryTabs, [id]: { ...s.queryTabs[id], result } } }
        : s,
    ),

  setActiveIndex: (index) => set({ activeIndex: index }),
  selectDoc: (doc, focusField = null) => set({ selectedDoc: doc, focusField }),
  setEditingConn: (id) => set({ editingConnId: id }),
  setTheme: (id) => {
    localStorage.setItem("elasticmin:theme", id);
    set({ theme: id });
  },

  toggleTheme: () =>
    set((s) => {
      // flip between light/dark base regardless of the current custom theme
      const theme = themeBase(s.theme) === "dark" ? "light" : "dark";
      localStorage.setItem("elasticmin:theme", theme);
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
    toastTimer = window.setTimeout(() => set({ toast: null }), 2600);
  },
  clearToast: () => {
    window.clearTimeout(toastTimer);
    set({ toast: null });
  },
}));
