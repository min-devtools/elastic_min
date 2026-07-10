import { useEffect } from "react";
import { Titlebar } from "./components/Titlebar";
import { Sidebar } from "./components/Sidebar";
import { TabsBar } from "./components/TabsBar";
import { Inspector } from "./components/Inspector";
import { Statusbar } from "./components/Statusbar";
import { CommandPalette } from "./components/CommandPalette";
import { Toast } from "./components/Toast";
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
import { inspectorAvailable, useApp } from "./store";
import { runActiveQuery, saveActiveQuery } from "./lib/runQuery";
import { themeBase } from "./lib/themes";
import { retintMonaco } from "./lib/monaco";
import type { TabDef } from "./lib/types";

function renderView(tab: TabDef, active: boolean) {
  switch (tab.kind) {
    case "welcome": return <WelcomeView key={tab.id} active={active} />;
    case "connection": return <ConnectionView key={tab.id} active={active} />;
    case "query": return <QueryView key={tab.id} tabId={tab.id} active={active} />;
    case "quick-query": return <QuickQueryView key={tab.id} active={active} />;
    case "docs": return <DocsView key={tab.id} active={active} />;
    case "indexes": return <IndexesView key={tab.id} active={active} />;
    case "create-index": return <CreateIndexView key={tab.id} active={active} />;
    case "cluster": return <ClusterView key={tab.id} active={active} />;
    case "mapping": return <MappingView key={tab.id} active={active} />;
    case "settings": return <SettingsView key={tab.id} active={active} />;
    case "history": return <HistoryView key={tab.id} active={active} />;
    case "index-stats": return <IndexStatsView key={tab.id} active={active} />;
  }
}

export default function App() {
  const {
    tabs, activeTabId, theme, compact, leftCollapsed, rightCollapsed,
    toggleLeft, toggleRight, setCommandOpen, newQueryTab, queryTabs,
  } = useApp();

  const inspectorOk = useApp((s) => inspectorAvailable(s));
  const running = queryTabs[activeTabId]?.running ?? false;
  const uiFont = useApp((s) => s.uiFont);
  const editorFont = useApp((s) => s.editorFont);

  // custom fonts override the design token stacks
  useEffect(() => {
    const st = document.body.style;
    if (uiFont) st.setProperty("--font-body", `"${uiFont}", system-ui, sans-serif`);
    else st.removeProperty("--font-body");
    if (editorFont) st.setProperty("--font-mono", `"${editorFont}", ui-monospace, Menlo, monospace`);
    else st.removeProperty("--font-mono");
  }, [uiFont, editorFont]);

  // mirror UI state onto <body> so the ported design CSS keeps working
  useEffect(() => {
    const cls = document.body.classList;
    const base = themeBase(theme);
    document.body.dataset.theme = theme;
    cls.toggle("light", base === "light");
    // sync Monaco background with the active theme's editor color
    requestAnimationFrame(() => {
      const bg = getComputedStyle(document.body).getPropertyValue("--editor-bg").trim();
      retintMonaco(base, bg);
    });
    cls.toggle("compact", compact);
    cls.toggle("left-collapsed", leftCollapsed);
    cls.toggle("right-collapsed", rightCollapsed);
    cls.toggle("inspector-unavailable", !inspectorOk);
    cls.toggle("running", running);
  }, [theme, compact, leftCollapsed, rightCollapsed, inspectorOk, running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
        runActiveQuery();
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
      if (mod && key === "d") {
        e.preventDefault();
        useApp.getState().openTab("docs");
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        useApp.getState().openTab("settings");
      }
      if (mod && key === "w") {
        e.preventDefault();
        const s = useApp.getState();
        s.closeTab(s.activeTabId);
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
        onClick={toggleLeft}
      >
        ◨
      </button>
      <button
        type="button"
        className={`tool-btn panel-toggle panel-corner right ${rightCollapsed || !inspectorOk ? "" : "active"}`}
        title="Toggle right inspector (⌘R)"
        onClick={toggleRight}
      >
        ◧
      </button>
      <CommandPalette />
      <Toast />
    </div>
  );
}
