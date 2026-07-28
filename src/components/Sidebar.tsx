import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "../ui/Badge";
import { IndexDot } from "../ui/Pills";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { activeConnId as activeConnIdOf, useApp } from "../store";
import { connStyle } from "../lib/connColor";
import { ColorPicker } from "../ui/ColorPicker";
import { useActiveConnection, useClusterHealth, useIndices } from "../lib/queries";
import { formatDocCount, formatNumber } from "../lib/format";
import type { TabKind } from "../lib/types";
import { Icon, type IconName } from "../ui/Icon";
import { pressable } from "../ui/pressable";

// Create Index / Mapping live as quick-links inside the Indexes tab; Nodes / Shards /
// Templates & ILM / Reindex / All Clusters live as quick-links inside the Cluster tab —
// keeps this list short while every destination stays one click away.
const WORKSPACE_NAV: { kind: TabKind; icon: IconName; iconClass: string; label: string; meta?: string }[] = [
  { kind: "welcome", icon: "sparkles", iconClass: "soft-blue", label: "Welcome" },
  { kind: "query", icon: "query", iconClass: "soft-blue", label: "Query Editor", meta: "⌘↵" },
  { kind: "quick-query", icon: "quick-query", iconClass: "soft-green", label: "Quick Query", meta: "mapping" },
  { kind: "docs", icon: "docs", iconClass: "soft-green", label: "Documents", meta: "⌘⇧D" },
  { kind: "indexes", icon: "indexes", iconClass: "soft-orange", label: "All Indexes" },
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
  const [pickingColor, setPickingColor] = useState<string | null>(null);
  const conn = useActiveConnection();
  const health = useClusterHealth();
  const indices = useIndices();
  const connections = useApp((s) => s.connections);
  const activeConnId = useApp(activeConnIdOf);
  const setActiveConn = useApp((s) => s.setActiveConn);
  const deleteConnection = useApp((s) => s.deleteConnection);
  const setEditingConn = useApp((s) => s.setEditingConn);
  const setConnections = useApp((s) => s.setConnections);
  const saveConnection = useApp((s) => s.saveConnection);
  // drag-reorder state for the Connections group — pattern matches redis_min Sidebar
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; before: boolean } | null>(null);
  const reorderConn = (from: string, beforeId: string | null) => {
    if (from === beforeId) return;
    const dragged = connections.find((c) => c.id === from);
    if (!dragged) return;
    const rest = connections.filter((c) => c.id !== from);
    const idx = beforeId ? rest.findIndex((c) => c.id === beforeId) : -1;
    setConnections(idx < 0 ? [...rest, dragged] : [...rest.slice(0, idx), dragged, ...rest.slice(idx)]);
  };
  const draggedConnId = (event: React.DragEvent) =>
    event.dataTransfer.getData("application/x-elasticmin-conn") || dragId;
  const activeKind = useApp((s) => s.tabs.find((t) => t.id === s.activeTabId)?.kind);
  const openTab = useApp((s) => s.openTab);
  const activeIndex = useApp((s) => s.activeIndex);
  const setActiveIndex = useApp((s) => s.setActiveIndex);
  const showToast = useApp((s) => s.showToast);
  const savedQueries = useApp((s) => s.savedQueries);
  const deleteSavedQuery = useApp((s) => s.deleteSavedQuery);
  const renameSavedQuery = useApp((s) => s.renameSavedQuery);
  const newQueryTab = useApp((s) => s.newQueryTab);
  const historyCount = useApp((s) => s.history.length);
  const openDialog = useApp((s) => s.openDialog);
  const indexRecency = useApp((s) => s.indexRecency);

  const q = filter.trim().toLowerCase();
  const indexList = useMemo(() => {
    // rank lookup once — indexOf inside the comparator is O(n·m·log n) on big clusters
    const rank = new Map(indexRecency.map((name, i) => [name, i]));
    return (indices.data ?? [])
      .filter((i) => !q || i.index.includes(q))
      .sort(
        (a, b) =>
          (rank.get(a.index) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.index) ?? Number.MAX_SAFE_INTEGER),
      );
  }, [indices.data, q, indexRecency]);
  const SIDEBAR_CAP = 5;
  const shownIndexes = q ? indexList.slice(0, 30) : indexList.slice(0, SIDEBAR_CAP);
  const hiddenIndexCount = q ? 0 : Math.max(0, indexList.length - SIDEBAR_CAP);
  const filteredSavedQueries = savedQueries.filter((sq) => !q || sq.name.toLowerCase().includes(q));
  const shownSavedQueries = filteredSavedQueries.slice(0, SIDEBAR_CAP);
  const hiddenSavedQueryCount = Math.max(0, filteredSavedQueries.length - SIDEBAR_CAP);

  const confirmDeleteConnection = async (id: string) => {
    const c = connections.find((x) => x.id === id);
    const ok = await openDialog({
      kind: "confirm",
      title: "Remove connection?",
      message: `"${c?.name ?? id}" and its stored credentials will be deleted.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok === null) return;
    deleteConnection(id);
    showToast("Connection removed", "Saved connection deleted from this workspace.");
  };

  const confirmDeleteSavedQuery = async (id: string) => {
    const sq = savedQueries.find((x) => x.id === id);
    const ok = await openDialog({
      kind: "confirm",
      title: "Delete saved query?",
      message: `"${sq?.name ?? id}" will be removed permanently.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok === null) return;
    deleteSavedQuery(id);
    showToast("Saved query deleted", "Removed from this workspace.");
  };

  // ⌘E / ⌘D / ⌘⌫ on the active connection — see design-systems/SHORTCUTS.md
  const editConn = (id: string) => {
    setEditingConn(id);
    openTab("connection");
  };
  const duplicateConn = (id: string) => {
    const c = connections.find((x) => x.id === id);
    if (!c) return;
    const copy = { ...c, id: crypto.randomUUID(), name: `${c.name} copy` };
    saveConnection(copy);
    showToast("Connection duplicated", copy.name);
  };

  // Listen globally because WebKit does not reliably dispatch modified shortcuts
  // through a div, but only act when a connection row owns keyboard focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (useApp.getState().dialog) return;
      const el = document.activeElement as HTMLElement | null;
      const editable = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (editable) return;
      const focusedConnId = el
        ?.closest<HTMLElement>("[data-connection-id]")
        ?.dataset.connectionId;
      if (
        !focusedConnId ||
        !connections.some((connection) => connection.id === focusedConnId)
      ) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "d") { event.preventDefault(); duplicateConn(focusedConnId); }
      else if (key === "e") { event.preventDefault(); editConn(focusedConnId); }
      // ⌘⌫ only — a plain Backspace outside inputs is too easy to hit by accident
      else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); void confirmDeleteConnection(focusedConnId); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections]);

  const connMenuItems: ContextMenuItem[] = connMenu
    ? [
        {
          icon: "plug",
          label: "Connect",
          strong: true,
          // conn id is part of every queryKey — switching refetches naturally
          onClick: () => setActiveConn(connMenu.id),
        },
        { icon: "pencil", label: "Edit connection", kbd: "⌘E", onClick: () => editConn(connMenu.id) },
        { icon: "status", label: "Set color…", onClick: () => setPickingColor(connMenu.id) },
        { icon: "copy", label: "Duplicate", kbd: "⌘D", onClick: () => duplicateConn(connMenu.id) },
        { icon: "trash", label: "Remove", kbd: "⌘⌫", onClick: () => void confirmDeleteConnection(connMenu.id) },
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
          <div className="group-title"><span>Workspace</span><span /></div>
          {WORKSPACE_NAV.map((item) => (
            <div
              key={item.kind}
              className={`nav-item ${activeKind === item.kind ? "active" : ""}`}
              onClick={() => openTab(item.kind)}
              {...pressable(() => openTab(item.kind))}
            >
              <Icon name={item.icon} className={item.iconClass} />
              <span>{item.label}</span>
              <span>
                {item.kind === "history"
                  ? historyCount || ""
                  : item.meta?.startsWith("⌘")
                    ? <span className="kbd">{item.meta}</span>
                    : item.meta ?? ""}
              </span>
            </div>
          ))}
        </div>

        <div className="group">
          <div className="group-title"><span>Connections</span><span>{connections.length ? "saved" : ""}</span></div>
          <div
            className={`nav-item ${activeKind === "connection" ? "active" : ""}`}
            onClick={() => {
              setEditingConn(null);
              openTab("connection");
            }}
            {...pressable(() => {
              setEditingConn(null);
              openTab("connection");
            })}
          >
            <Icon name="plus" className="soft-blue" /><span>New Connection</span><Badge>setup</Badge>
          </div>
          <AnimatePresence initial={false}>
            {connections.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
                draggable
                data-connection-id={c.id}
                className={`nav-item ${c.id === activeConnId ? "active" : ""} ${dragId === c.id ? "dragging" : ""} ${dropTarget?.id === c.id && dragId && dragId !== c.id ? (dropTarget.before ? "drop-before" : "drop-after") : ""}`}
                onClick={() => setActiveConn(c.id)}
                onPointerDown={(e) => e.currentTarget.focus()}
                {...pressable(() => setActiveConn(c.id))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setConnMenu({ x: e.clientX, y: e.clientY, id: c.id });
                }}
                onDragStart={(e: any) => {
                  setDragId(c.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("application/x-elasticmin-conn", c.id);
                }}
                onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                onDragOver={(e: any) => {
                  if (!dragId || dragId === c.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDropTarget({ id: c.id, before: e.clientY < rect.top + rect.height / 2 });
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDropTarget((t) => (t?.id === c.id ? null : t));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = draggedConnId(e);
                  if (id && id !== c.id) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const before = e.clientY < rect.top + rect.height / 2;
                    const nextId = before
                      ? c.id
                      : connections[connections.findIndex((cc) => cc.id === c.id) + 1]?.id ?? null;
                    reorderConn(id, nextId);
                  }
                  setDragId(null);
                  setDropTarget(null);
                }}
              >
                <span
                  className="conn-dot"
                  style={connStyle(c.color)}
                  title={c.color ? `Color: ${c.color}` : "No color — right-click to set one"}
                />
                <span>{c.name}</span>
                <Badge tone={c.id === activeConnId ? health.data?.status ?? "idle" : "idle"}>
                  {c.id === activeConnId ? health.data?.status ?? "connecting…" : "idle"}
                </Badge>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {savedQueries.length > 0 && (
          <div className="group">
            <div className="group-title"><span>Saved queries</span><span>{formatNumber(savedQueries.length)}</span></div>
            <AnimatePresence initial={false}>
              {shownSavedQueries.map((sq) => (
                <motion.div
                  key={sq.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  className="nav-item"
                  title={`${sq.method} ${sq.path}`}
                  onClick={() => newQueryTab({ method: sq.method, path: sq.path, body: sq.body })}
                  {...pressable(() => newQueryTab({ method: sq.method, path: sq.path, body: sq.body }))}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setQueryMenu({ x: e.clientX, y: e.clientY, id: sq.id });
                  }}
                >
                  <Icon name="save" className="soft-blue" />
                  <span>{sq.name}</span>
                  <Badge>{sq.method}</Badge>
                </motion.div>
              ))}
            </AnimatePresence>
            {hiddenSavedQueryCount > 0 && (
              <div className="nav-item" onClick={() => openTab("saved-queries")}>
                <Icon name="more-horizontal" className="soft-blue" />
                <span>{formatNumber(hiddenSavedQueryCount)} more…</span>
              </div>
            )}
          </div>
        )}

        <div className="group">
          <div className="group-title">
            <span>Indexes</span>
            <span>{indices.data ? formatNumber(indices.data.length) : conn ? "…" : ""}</span>
          </div>
          {!conn && <div className="empty-note">Connect to a cluster to load indexes.</div>}
          <AnimatePresence initial={false}>
            {shownIndexes.map((i) => (
              <motion.div
                key={i.index}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
                className={`index-item ${i.index === activeIndex ? "active" : ""}`}
                onClick={() => setActiveIndex(i.index)}
                {...pressable(() => setActiveIndex(i.index))}
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
              </motion.div>
            ))}
          </AnimatePresence>
          {hiddenIndexCount > 0 && (
            <div className="nav-item" onClick={() => openTab("indexes")}>
              <Icon name="more-horizontal" className="soft-orange" />
              <span>{formatNumber(hiddenIndexCount)} more…</span>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {connMenu && (
          <ContextMenu x={connMenu.x} y={connMenu.y} items={connMenuItems} onClose={() => setConnMenu(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pickingColor && (
          <ColorPicker
            value={connections.find((c) => c.id === pickingColor)?.color}
            onPick={(color) => {
              const c = connections.find((x) => x.id === pickingColor);
              if (c) saveConnection({ ...c, color: color ?? undefined });
            }}
            onClose={() => setPickingColor(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
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
      </AnimatePresence>
      <AnimatePresence>
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
                onClick: () => void confirmDeleteSavedQuery(queryMenu.id),
              },
            ]}
          />
        )}
      </AnimatePresence>
    </aside>
  );
}
