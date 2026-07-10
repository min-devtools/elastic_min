import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "../ui/Badge";
import { IndexDot } from "../ui/Pills";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { useApp } from "../store";
import { useActiveConnection, useClusterHealth, useIndices } from "../lib/queries";
import { formatDocCount } from "../lib/format";
import type { TabKind } from "../lib/types";

const WORKSPACE_NAV: { kind: TabKind; icon: string; iconClass: string; label: string; meta?: string }[] = [
  { kind: "welcome", icon: "◆", iconClass: "soft-blue", label: "Welcome" },
  { kind: "query", icon: "⌁", iconClass: "soft-blue", label: "Query Editor", meta: "⌘↵" },
  { kind: "quick-query", icon: "⌕", iconClass: "soft-green", label: "Quick Query", meta: "mapping" },
  { kind: "docs", icon: "▤", iconClass: "soft-green", label: "Documents", meta: "⌘D" },
  { kind: "indexes", icon: "◧", iconClass: "soft-orange", label: "All Indexes" },
  { kind: "mapping", icon: "⌬", iconClass: "soft-blue", label: "Mapping" },
  { kind: "create-index", icon: "＋", iconClass: "soft-green", label: "Create Index" },
  { kind: "cluster", icon: "◌", iconClass: "soft-green", label: "Cluster" },
  { kind: "history", icon: "↺", iconClass: "soft-orange", label: "Query History" },
  { kind: "settings", icon: "⚙", iconClass: "soft-orange", label: "Settings", meta: "⌘," },
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
    savedQueries, deleteSavedQuery, renameSavedQuery, newQueryTab, history,
  } = useApp();

  const activeKind = tabs.find((t) => t.id === activeTabId)?.kind;
  const q = filter.trim().toLowerCase();
  const indexList = (indices.data ?? []).filter((i) => !q || i.index.includes(q));
  const shownIndexes = q ? indexList.slice(0, 30) : indexList.slice(0, 12);
  const aliasCount = new Set((indices.data ?? []).flatMap((i) => i.aliases)).size;

  const connMenuItems: ContextMenuItem[] = connMenu
    ? [
        {
          icon: "●",
          label: "Connect",
          strong: true,
          onClick: () => {
            setActiveConn(connMenu.id);
            void queryClient.invalidateQueries();
          },
        },
        {
          icon: "✎",
          label: "Edit connection",
          onClick: () => {
            setEditingConn(connMenu.id);
            openTab("connection");
          },
        },
        {
          icon: "×",
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
            <span className="soft-blue">＋</span><span>New Connection</span><Badge>setup</Badge>
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
              <span>{c.id === activeConnId ? "●" : "○"}</span>
              <span>{c.name}</span>
              <Badge>{c.id === activeConnId ? health.data?.status ?? "…" : "idle"}</Badge>
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
              <span className={item.iconClass}>{item.icon}</span>
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
                  <span className="soft-blue">⌘</span>
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
              <span>≋</span><span>Aliases</span><span>{aliasCount || ""}</span>
            </div>
            <div className="nav-item" onClick={() => openTab("cluster")}>
              <span>◌</span><span>Cluster health</span><span>{health.data?.status ?? ""}</span>
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
            { icon: "▤", label: "Open Documents", strong: true, onClick: () => openTab("docs") },
            {
              icon: "⌁", label: "Open in Query", strong: true,
              onClick: () => newQueryTab({ path: `/${indexMenu.index}/_search` }),
            },
            { icon: "⌬", label: "Open Mapping", onClick: () => openTab("mapping") },
            { icon: "∿", label: "Index stats", onClick: () => openTab("index-stats") },
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
              icon: "⌁",
              label: "Open in new Query tab",
              strong: true,
              onClick: () => {
                const sq = savedQueries.find((x) => x.id === queryMenu.id);
                if (sq) newQueryTab({ method: sq.method, path: sq.path, body: sq.body });
              },
            },
            {
              icon: "✎",
              label: "Rename",
              onClick: () => {
                const sq = savedQueries.find((x) => x.id === queryMenu.id);
                const name = window.prompt("Rename saved query:", sq?.name ?? "");
                if (name?.trim()) renameSavedQuery(queryMenu.id, name);
              },
            },
            {
              icon: "×",
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
