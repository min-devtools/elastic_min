import { useApp } from "../store";
import { useActiveConnection, useClusterHealth, useClusterInfo } from "../lib/queries";
import { version } from "../../package.json";

export function Statusbar() {
  const conn = useActiveConnection();
  const health = useClusterHealth();
  const info = useClusterInfo();
  const { tabs, activeTabId, activeIndex, queryTabs, openTab, setEditingConn } = useApp();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const qt = activeTab?.kind === "query" ? queryTabs[activeTabId] : null;
  const statusColor =
    health.data?.status === "green"
      ? "var(--green)"
      : health.data?.status === "yellow"
        ? "var(--orange)"
        : health.data?.status === "red"
          ? "var(--red)"
          : "var(--orange)";

  return (
    <footer className="statusbar">
      <div>
        <span
          style={{ cursor: "pointer" }}
          title="Open connection settings"
          onClick={() => {
            setEditingConn(conn?.id ?? null);
            openTab("connection");
          }}
        >
          {conn ? conn.name : "no connection"}
        </span>
        <span style={{ color: statusColor }}>
          {conn ? health.data?.status ?? "connecting…" : "setup required"}
        </span>
      </div>
      <div>
        <span
          style={{ cursor: activeIndex ? "pointer" : undefined }}
          title={activeIndex ? "Open Documents (⌘D)" : undefined}
          onClick={() => activeIndex && openTab("docs")}
        >
          {activeIndex ?? "no index selected"}
        </span>
        <span>
          {qt?.result?.hits ? `${qt.result.total ?? qt.result.hits.length} hits` : "0 hits"}
        </span>
        <span>{qt?.running ? "running" : qt?.result ? `${qt.result.timeMs}ms` : "idle"}</span>
      </div>
      <div className="right-status">
        <span>{info.data ? `ES ${info.data.version.number}` : ""}</span>
        <span>UTF-8</span>
        <span>{activeTab?.title ?? ""}</span>
        <span>v{version}</span>
      </div>
    </footer>
  );
}
