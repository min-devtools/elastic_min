import { useEffect } from "react";
import { Titlebar } from "./components/Titlebar";
import { Sidebar } from "./components/Sidebar";
import { TabsBar } from "./components/TabsBar";
import { Inspector } from "./components/Inspector";
import { Statusbar } from "./components/Statusbar";
import { CommandPalette } from "./components/CommandPalette";
import { Toast } from "./components/Toast";
import { Dialog } from "./components/Dialog";
import { PanelResizeHandles } from "./components/ResizeHandles";
import { WelcomeView } from "./components/views/WelcomeView";
import { ConnectionView } from "./components/views/ConnectionView";
import { QueryView } from "./components/views/QueryView";
import { QuickQueryView } from "./components/views/QuickQueryView";
import { DocsView } from "./components/views/DocsView";
import { IndexesView } from "./components/views/IndexesView";
import { CreateIndexView } from "./components/views/CreateIndexView";
import { ClusterView } from "./components/views/ClusterView";
import { MappingView } from "./components/views/MappingView";
import { SettingsView } from "./components/views/SettingsView";
import { HistoryView } from "./components/views/HistoryView";
import { IndexStatsView } from "./components/views/IndexStatsView";
import { SavedQueriesView } from "./components/views/SavedQueriesView";
import { closeTabWithConfirm, inspectorAvailable, useApp } from "./store";
import { runActiveQuery, saveActiveQuery } from "./lib/runQuery";
import { themeBase } from "./lib/themes";
import { retintMonaco } from "./lib/monaco";
import { applyPalette, readBuiltinPalette } from "./lib/themeContract";
import { activeSubmitTarget } from "./lib/activeQuery";
import type { TabDef } from "./lib/types";
import { Icon } from "./ui/Icon";

function renderView(tab: TabDef, active: boolean) {
  switch (tab.kind) {
    case "welcome": return <WelcomeView key={tab.id} active={active} />;
    case "connection": return <ConnectionView key={tab.id} active={active} />;
    case "query": return <QueryView key={tab.id} tabId={tab.id} active={active} />;
    case "quick-query": return <QuickQueryView key={tab.id} active={active} />;
    case "docs": return <DocsView key={tab.id} tabId={tab.id} active={active} />;
    case "indexes": return <IndexesView key={tab.id} active={active} />;
    case "create-index": return <CreateIndexView key={tab.id} active={active} />;
    case "cluster": return <ClusterView key={tab.id} active={active} />;
    case "mapping": return <MappingView key={tab.id} active={active} />;
    case "settings": return <SettingsView key={tab.id} active={active} />;
    case "history": return <HistoryView key={tab.id} active={active} />;
    case "index-stats": return <IndexStatsView key={tab.id} active={active} />;
    case "saved-queries": return <SavedQueriesView key={tab.id} active={active} />;
  }
}

export default function App() {
  // per-field selectors — a whole-store subscribe here re-renders every mounted
  // view on each Monaco keystroke (queryTabs changes on every edit)
  const tabs = useApp((s) => s.tabs);
  const activeTabId = useApp((s) => s.activeTabId);
  const theme = useApp((s) => s.theme);
  const compact = useApp((s) => s.compact);
  const leftCollapsed = useApp((s) => s.leftCollapsed);
  const rightCollapsed = useApp((s) => s.rightCollapsed);
  const toggleLeft = useApp((s) => s.toggleLeft);
  const toggleRight = useApp((s) => s.toggleRight);
  const setCommandOpen = useApp((s) => s.setCommandOpen);
  const newQueryTab = useApp((s) => s.newQueryTab);

  const inspectorOk = useApp((s) => inspectorAvailable(s));
  const running = useApp((s) => s.queryTabs[s.activeTabId]?.running ?? false);
  const uiFont = useApp((s) => s.uiFont);
  const editorFont = useApp((s) => s.editorFont);
  const uiFontSize = useApp((s) => s.uiFontSize);

  // custom fonts override the design token stacks
  useEffect(() => {
    const st = document.documentElement.style;
    st.setProperty("--font-body", uiFont ? `"${uiFont}", var(--font-body-default)` : "var(--font-body-default)");
    st.setProperty("--font-mono", editorFont ? `"${editorFont}", var(--font-mono-default)` : "var(--font-mono-default)");
  }, [uiFont, editorFont]);

  // app-wide UI scale — base.css html rule reads this as its font-size
  useEffect(() => {
    document.documentElement.style.setProperty("--ui-font-size", `${uiFontSize}px`);
  }, [uiFontSize]);

  // mirror UI state onto <body> so the ported design CSS keeps working
  useEffect(() => {
    const cls = document.body.classList;
    const base = themeBase(theme);
    document.body.dataset.theme = theme;
    cls.toggle("light", base === "light");
    // sync Monaco's own theme (bg + syntax colors) to the active app theme's palette
    requestAnimationFrame(() => {
      const cs = getComputedStyle(document.body);
      const v = (name: string) => cs.getPropertyValue(name).trim();
      const palette = readBuiltinPalette(cs);
      applyPalette(document.body.style, palette);
      retintMonaco(base, {
        accentPrimary: v("--accent-primary"),
        accentFocus: v("--accent-focus"),
        syntaxKey: v("--blue-2"),
        syntaxString: v("--syntax-string"),
        syntaxNumber: v("--syntax-number"),
        syntaxBoolean: v("--syntax-boolean"),
        syntaxNull: v("--syntax-null"),
        textPrimary: v("--text-primary"),
        textMuted: v("--text-muted"),
        editorForeground: v("--editor-fg"),
        surfaceEditor: v("--surface-editor"),
        surfaceRaised: v("--surface-raised"),
        borderDefault: v("--border-default"),
        statusDanger: v("--status-danger"),
        statusWarning: v("--status-warning"),
      });
    });
    cls.toggle("compact", compact);
    cls.toggle("left-collapsed", leftCollapsed);
    cls.toggle("right-collapsed", rightCollapsed);
    cls.toggle("inspector-unavailable", !inspectorOk);
    cls.toggle("running", running);
  }, [theme, compact, leftCollapsed, rightCollapsed, inspectorOk, running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Monaco's own addCommand bindings (e.g. ⌘↵ in the query editor) call preventDefault
      // before this bubbles to document — skip so we don't double-fire the same shortcut.
      if (e.defaultPrevented) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (mod && key === "n") {
        e.preventDefault();
        newQueryTab();
      }
      if (mod && e.key === "Enter") {
        e.preventDefault();
        const s = useApp.getState();
        const tab = s.tabs.find((candidate) => candidate.id === s.activeTabId);
        const target = activeSubmitTarget(tab);
        if (target === "query") runActiveQuery();
        if (target === "docs" && tab) {
          document.querySelector<HTMLFormElement>(`#docs-search-${tab.id}`)?.requestSubmit();
        }
      }
      if (mod && key === "s") {
        e.preventDefault();
        saveActiveQuery();
      }
      if (mod && key === "b") {
        e.preventDefault();
        toggleLeft();
      }
      if (mod && key === "r") {
        e.preventDefault();
        toggleRight();
      }
      // ⌘⇧D, not ⌘D — ⌘D is reserved app-wide for "duplicate selected item"
      if (mod && e.shiftKey && key === "d") {
        e.preventDefault();
        useApp.getState().openDocsTab();
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        useApp.getState().openTab("settings");
      }
      if (mod && key === "w") {
        e.preventDefault();
        void closeTabWithConfirm(useApp.getState().activeTabId);
      }
      // ctrl-tab / ctrl-shift-tab and ⇧⌘[ / ⇧⌘] — cycle tabs
      const cycle =
        (e.ctrlKey && e.key === "Tab") ||
        (mod && e.shiftKey && (e.key === "[" || e.key === "]" || e.key === "{" || e.key === "}"));
      if (cycle) {
        e.preventDefault();
        const s = useApp.getState();
        const idx = s.tabs.findIndex((t) => t.id === s.activeTabId);
        const back = (e.ctrlKey && e.shiftKey) || e.key === "[" || e.key === "{";
        const next = s.tabs[(idx + (back ? -1 : 1) + s.tabs.length) % s.tabs.length];
        if (next) s.activateTab(next.id);
      }
      // ⌘1…⌘9 — jump to the Nth tab
      if (mod && key >= "1" && key <= "9") {
        const s = useApp.getState();
        const tab = s.tabs[Number(key) - 1];
        if (tab) {
          e.preventDefault();
          s.activateTab(tab.id);
        }
      }
      // ⌘+/⌘- — app-wide UI font size, 0.5px per press
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        const s = useApp.getState();
        s.setUiFontSize(s.uiFontSize + 0.5);
      }
      if (mod && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        const s = useApp.getState();
        s.setUiFontSize(s.uiFontSize - 0.5);
      }
      if (e.key === "Escape") setCommandOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setCommandOpen, newQueryTab, toggleLeft, toggleRight]);

  return (
    <div className="app-frame">
      <Titlebar />
      <main className="main">
        <Sidebar />
        <section className="workspace">
          <TabsBar />
          {tabs.map((tab) => renderView(tab, tab.id === activeTabId))}
        </section>
        <Inspector />
        <PanelResizeHandles />
      </main>
      <Statusbar />
      <button
        type="button"
        className={`tool-btn panel-toggle panel-corner left ${leftCollapsed ? "" : "active"}`}
        title="Toggle left sidebar (⌘B)"
        aria-label="Toggle left sidebar"
        onClick={toggleLeft}
      >
        <Icon name="panel-left" />
      </button>
      <button
        type="button"
        className={`tool-btn panel-toggle panel-corner right ${rightCollapsed || !inspectorOk ? "" : "active"}`}
        title="Toggle right inspector (⌘R)"
        aria-label="Toggle right inspector"
        onClick={toggleRight}
      >
        <Icon name="panel-right" />
      </button>
      <CommandPalette />
      <Toast />
      <Dialog />
    </div>
  );
}
