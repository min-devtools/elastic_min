import { useQueryClient } from "@tanstack/react-query";
import { ToolButton } from "../ui/ToolButton";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/Icon";
import { runActiveQuery } from "../lib/runQuery";
import { useApp } from "../store";
import { useActiveConnection, useClusterHealth } from "../lib/queries";
import logo from "../assets/logo.png";
import { themeBase } from "../lib/themes";

export function Titlebar() {
  const conn = useActiveConnection();
  const health = useClusterHealth();
  const {
    newQueryTab, toggleTheme, toggleCompact, setCommandOpen, showToast,
    activeTabId, tabs, queryTabs, updateQueryTab, theme, openTab,
  } = useApp();
  const queryClient = useQueryClient();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const running = activeTab?.kind === "query" && queryTabs[activeTabId]?.running;

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="traffic">
        <img src={logo} alt="" className="app-logo" />
        <strong>ElasticMin</strong>
        <Badge tone={health.data?.status ?? "idle"}>{conn ? health.data?.status ?? "connecting…" : "no cluster"}</Badge>
      </div>
      <button type="button" className="search" title="Search everywhere (⌘K)" onClick={() => setCommandOpen(true)}>
        <Icon name="search" size={13} />
        <span>Search Everywhere</span>
        <span style={{ marginLeft: "auto" }} />
        <kbd>⌘K</kbd>
      </button>
      <div className="toolbar">
        <ToolButton iconOnly variant="primary" title="Run current query (⌘↵)" aria-label="Run current query" onClick={runActiveQuery}>
          <Icon name="play" />
        </ToolButton>
        <ToolButton iconOnly title="New query tab (⌘N)" aria-label="New query tab" onClick={() => newQueryTab()}>
          <Icon name="plus" />
        </ToolButton>
        <ToolButton
          variant="danger"
          disabled={!running}
          onClick={() => {
            if (activeTab?.kind === "query") updateQueryTab(activeTabId, { running: false });
            showToast("Query cancelled", "The active request result will be ignored.");
          }}
          iconOnly
          title="Cancel running query"
          aria-label="Cancel running query"
        >
          <Icon name="x" />
        </ToolButton>
        <ToolButton
          iconOnly
          title="Reload cluster health, indexes and mappings"
          aria-label="Refresh cluster data"
          onClick={() => {
            void queryClient.invalidateQueries();
            showToast("Refreshed", "Cluster health, indexes and mappings are being reloaded.");
          }}
        >
          <Icon name="refresh" />
        </ToolButton>
        <ToolButton iconOnly title="Toggle theme" aria-label="Toggle theme" onClick={toggleTheme}>
          <Icon name={themeBase(theme) === "dark" ? "sun" : "moon"} />
        </ToolButton>
        <ToolButton iconOnly title="Toggle compact density" aria-label="Toggle compact density" onClick={toggleCompact}>
          <Icon name="rows" />
        </ToolButton>
        <ToolButton iconOnly title="Settings (⌘,)" aria-label="Open settings" onClick={() => openTab("settings")}>
          <Icon name="settings" />
        </ToolButton>
      </div>
    </header>
  );
}
