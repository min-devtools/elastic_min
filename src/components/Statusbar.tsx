import { openUrl } from "@tauri-apps/plugin-opener";
import { useApp } from "../store";
import { useActiveConnection, useClusterHealth, useClusterInfo } from "../lib/queries";

export function Statusbar() {
  const conn = useActiveConnection();
  const health = useClusterHealth();
  const info = useClusterInfo();
  const activeIndex = useApp((s) => s.activeIndex);
  const openTab = useApp((s) => s.openTab);
  const setEditingConn = useApp((s) => s.setEditingConn);
  const activeTabTitle = useApp((s) => s.tabs.find((t) => t.id === s.activeTabId)?.title);
  const qt = useApp((s) =>
    s.tabs.find((t) => t.id === s.activeTabId)?.kind === "query" ? s.queryTabs[s.activeTabId] : null,
  );
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
          {qt?.result?.hits ? `${qt.result.total ?? qt.result.hits.length} hits` : "—"}
        </span>
        <span>{qt?.running ? "running" : qt?.result ? `${qt.result.timeMs}ms` : "idle"}</span>
      </div>
      <div className="right-status">
        <span>{info.data ? `ES ${info.data.version.number}` : ""}</span>
        <span>UTF-8</span>
        <span>{activeTabTitle ?? ""}</span>
        <span>v{__APP_VERSION__}</span>
        <span
          className="credit"
          style={{ cursor: "pointer" }}
          title="Created by @ngthminhdev — open LinkedIn"
          onClick={() => openUrl("https://www.linkedin.com/in/ngthminh-dev/")}
        >
          by @ngthminhdev
        </span>
      </div>
    </footer>
  );
}
