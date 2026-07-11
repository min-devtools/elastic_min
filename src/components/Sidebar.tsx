import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "../ui/Badge";
import { IndexDot } from "../ui/Pills";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { useApp } from "../store";
import { useActiveConnection, useClusterHealth, useIndices } from "../lib/queries";
import { formatDocCount } from "../lib/format";
import type { TabKind } from "../lib/types";
import { Icon, type IconName } from "../ui/Icon";

const WORKSPACE_NAV: { kind: TabKind; icon: IconName; iconClass: string; label: string; meta?: string }[] = [
  { kind: "welcome", icon: "sparkles", iconClass: "soft-blue", label: "Welcome" },
  { kind: "query", icon: "query", iconClass: "soft-blue", label: "Query Editor", meta: "⌘↵" },
  { kind: "quick-query", icon: "quick-query", iconClass: "soft-green", label: "Quick Query", meta: "mapping" },
  { kind: "docs", icon: "docs", iconClass: "soft-green", label: "Documents", meta: "⌘D" },
  { kind: "indexes", icon: "indexes", iconClass: "soft-orange", label: "All Indexes" },
  { kind: "mapping", icon: "mapping", iconClass: "soft-blue", label: "Mapping" },
  { kind: "create-index", icon: "folder-plus", iconClass: "soft-green", label: "Create Index" },
  { kind: "cluster", icon: "cluster", iconClass: "soft-green", label: "Cluster" },
  { kind: "history", icon: "history", iconClass: "soft-orange", label: "Query History" },
  { kind: "saved-queries", icon: "save", iconClass: "soft-blue", label: "Saved Queries" },
  { kind: "settings", icon: "settings", iconClass: "soft-orange", label: "Settings", meta: "⌘," },
];

export function Sidebar() {
  const [filter, setFilter] = useState("");
  const [connMenu, setConnMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [queryMenu, setQueryMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [indexMenu, setIndexMenu] = useState<{ x: number; y: number; index: string } | null>(null);
  const conn = useActiveConnection();
  const health = useClusterHealth();
  const indices = useIndices();
  const queryClient = useQueryClient();
  const {
    connections, activeConnId, setActiveConn, deleteConnection, setEditingConn,
    tabs, activeTabId, openTab, activeIndex, setActiveIndex, showToast,
    savedQueries, deleteSavedQuery, renameSavedQuery, newQueryTab, history, openDialog,
  } = useApp();

  const activeKind = tabs.find((t) => t.id === activeTabId)?.kind;
  const q = filter.trim().toLowerCase();
  const indexList = (indices.data ?? []).filter((i) => !q || i.index.includes(q));
  const shownIndexes = q ? indexList.slice(0, 30) : indexList.slice(0, 12);
  const aliasCount = new Set((indices.data ?? []).flatMap((i) => i.aliases)).size;

  const connMenuItems: ContextMenuItem[] = connMenu
    ? [
        {
          icon: "plug",
          label: "Connect",
          strong: true,
          onClick: () => {
            setActiveConn(connMenu.id);
            void queryClient.invalidateQueries();
          },
        },
        {
          icon: "pencil",
          label: "Edit connection",
          onClick: () => {
            setEditingConn(connMenu.id);
            openTab("connection");
          },
        },
        {
          icon: "trash",
          label: "Remove",
          onClick: () => {
            deleteConnection(connMenu.id);
            showToast("Connection removed", "Saved connection deleted from this workspace.");
          },
        },
      ]
    : [];

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <input
          className="side-search"
          placeholder="Search indexes, queries, clusters"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="side-scroll">
        <div className="group">
          <div className="group-title"><span>Connections</span><span>{connections.length ? "saved" : ""}</span></div>
          <div
            className={`nav-item ${activeKind === "connection" ? "active" : ""}`}
            onClick={() => {
              setEditingConn(null);
              openTab("connection");
            }}
          >
            <Icon name="plus" className="soft-blue" /><span>New Connection</span><Badge>setup</Badge>
          </div>
          {connections.map((c) => (
            <div
              key={c.id}
              className={`nav-item ${c.id === activeConnId ? "active" : ""}`}
              onClick={() => {
                setActiveConn(c.id);
                void queryClient.invalidateQueries();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setConnMenu({ x: e.clientX, y: e.clientY, id: c.id });
              }}
            >
              <Icon name="status" className={c.id === activeConnId ? "soft-green" : undefined} />
              <span>{c.name}</span>
              <Badge tone={c.id === activeConnId ? health.data?.status ?? "idle" : "idle"}>
                {c.id === activeConnId ? health.data?.status ?? "connecting…" : "idle"}
              </Badge>
            </div>
          ))}
        </div>

        <div className="group">
          <div className="group-title"><span>Workspace</span><span /></div>
          {WORKSPACE_NAV.map((item) => (
            <div
              key={item.kind}
              className={`nav-item ${activeKind === item.kind ? "active" : ""}`}
              onClick={() => openTab(item.kind)}
            >
              <Icon name={item.icon} className={item.iconClass} />
              <span>{item.label}</span>
              <span>
                {item.kind === "history"
                  ? history.length || ""
                  : item.meta?.startsWith("⌘")
                    ? <span className="kbd">{item.meta}</span>
                    : item.meta ?? ""}
              </span>
            </div>
          ))}
        </div>

        {savedQueries.length > 0 && (
          <div className="group">
            <div className="group-title"><span>Saved queries</span><span>{savedQueries.length}</span></div>
            {savedQueries
              .filter((sq) => !q || sq.name.toLowerCase().includes(q))
              .map((sq) => (
                <div
                  key={sq.id}
                  className="nav-item"
                  title={`${sq.method} ${sq.path}`}
                  onClick={() => newQueryTab({ method: sq.method, path: sq.path, body: sq.body })}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setQueryMenu({ x: e.clientX, y: e.clientY, id: sq.id });
                  }}
                >
                  <Icon name="save" className="soft-blue" />
                  <span>{sq.name}</span>
                  <Badge>{sq.method}</Badge>
                </div>
              ))}
          </div>
        )}

        <div className="group">
          <div className="group-title">
            <span>Indexes</span>
            <span>{indices.data ? indices.data.length : conn ? "…" : ""}</span>
          </div>
          {!conn && <div className="empty-note">Connect to a cluster to load indexes.</div>}
          {shownIndexes.map((i) => (
            <div
              key={i.index}
              className={`index-item ${i.index === activeIndex ? "active" : ""}`}
              onClick={() => setActiveIndex(i.index)}
              onDoubleClick={() => {
                setActiveIndex(i.index);
                openTab("docs");
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setActiveIndex(i.index);
                setIndexMenu({ x: e.clientX, y: e.clientY, index: i.index });
              }}
            >
              <IndexDot health={i.health} />
              <span>{i.index}</span>
              <span>{formatDocCount(i.docsCount)}</span>
            </div>
          ))}
        </div>

        {conn && (
          <div className="group">
            <div className="group-title"><span>Database objects</span><span /></div>
            <div className="nav-item" onClick={() => openTab("indexes")}>
              <Icon name="database" /><span>Aliases</span><span>{aliasCount || ""}</span>
            </div>
            <div className="nav-item" onClick={() => openTab("cluster")}>
              <Icon name="cluster" /><span>Cluster health</span><span>{health.data?.status ?? ""}</span>
            </div>
          </div>
        )}
      </div>
      {connMenu && (
        <ContextMenu x={connMenu.x} y={connMenu.y} items={connMenuItems} onClose={() => setConnMenu(null)} />
      )}
      {indexMenu && (
        <ContextMenu
          x={indexMenu.x}
          y={indexMenu.y}
          onClose={() => setIndexMenu(null)}
          items={[
            { icon: "docs", label: "Open Documents", strong: true, onClick: () => openTab("docs") },
            {
              icon: "query", label: "Open in Query", strong: true,
              onClick: () => newQueryTab({ path: `/${indexMenu.index}/_search` }),
            },
            { icon: "mapping", label: "Open Mapping", onClick: () => openTab("mapping") },
            { icon: "activity", label: "Index stats", onClick: () => openTab("index-stats") },
          ]}
        />
      )}
      {queryMenu && (
        <ContextMenu
          x={queryMenu.x}
          y={queryMenu.y}
          onClose={() => setQueryMenu(null)}
          items={[
            {
              icon: "query",
              label: "Open in new Query tab",
              strong: true,
              onClick: () => {
                const sq = savedQueries.find((x) => x.id === queryMenu.id);
                if (sq) newQueryTab({ method: sq.method, path: sq.path, body: sq.body });
              },
            },
            {
              icon: "pencil",
              label: "Rename",
              onClick: async () => {
                const sq = savedQueries.find((x) => x.id === queryMenu.id);
                const name = await openDialog({
                  kind: "prompt",
                  title: "Rename saved query",
                  defaultValue: sq?.name ?? "",
                  confirmLabel: "Rename",
                });
                if (name?.trim()) renameSavedQuery(queryMenu.id, name);
              },
            },
            {
              icon: "trash",
              label: "Delete",
              onClick: () => {
                deleteSavedQuery(queryMenu.id);
                showToast("Saved query deleted", "Removed from this workspace.");
              },
            },
          ]}
        />
      )}
    </aside>
  );
}
