import { useEffect, useRef, useState } from "react";
import { closeTabWithConfirm, tabConnection, useApp } from "../store";
import { connStyle } from "../lib/connColor";
import { ContextMenu } from "../ui/ContextMenu";
import { Icon } from "../ui/Icon";

export function TabsBar() {
  const tabs = useApp((s) => s.tabs);
  const connections = useApp((s) => s.connections);
  const activeTabId = useApp((s) => s.activeTabId);
  const activateTab = useApp((s) => s.activateTab);
  const newQueryTab = useApp((s) => s.newQueryTab);
  const renameTab = useApp((s) => s.renameTab);
  const reorderTab = useApp((s) => s.reorderTab);
  const closeTab = (id: string) => void closeTabWithConfirm(id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // the bar scrolls, so a tab reached by ⌘1-9 / the palette / a close can be off-screen
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const commit = () => {
    if (editingId) renameTab(editingId, draft);
    setEditingId(null);
  };

  const draggedTabId = (event: React.DragEvent) =>
    event.dataTransfer.getData("application/x-elasticmin-tab") || dragId;

  return (
    <nav className="tabs">
      {tabs.map((tab) => {
        const conn = tabConnection({ connections }, tab);
        return (
        <button
          key={tab.id}
          ref={tab.id === activeTabId ? activeRef : undefined}
          type="button"
          draggable={!editingId}
          className={`tab ${tab.id === activeTabId ? "active" : ""} ${dragId === tab.id ? "dragging" : ""} ${overId === tab.id && dragId && dragId !== tab.id ? "drag-over" : ""}`}
          style={connStyle(conn?.color)}
          onClick={() => activateTab(tab.id)}
          onAuxClick={(e) => {
            // middle-click closes the tab
            if (e.button === 1) closeTab(tab.id);
          }}
          onDoubleClick={() => {
            if (tab.kind !== "query") return;
            setEditingId(tab.id);
            setDraft(tab.title);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, id: tab.id });
          }}
          onDragStart={(e) => {
            setDragId(tab.id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("application/x-elasticmin-tab", tab.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
          onDragOver={(e) => {
            if (!dragId || dragId === tab.id) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOverId(tab.id);
          }}
          onDragLeave={() => setOverId((o) => (o === tab.id ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            const id = draggedTabId(e);
            if (id && id !== tab.id) reorderTab(id, tab.id);
            setDragId(null);
            setOverId(null);
          }}
          title={conn ? `${tab.title} Â· ${conn.name}` : tab.kind === "query" ? "Double-click to rename Â· right-click for menu" : undefined}
        >
          {conn && <span className="conn-dot" />}
          <Icon name={tab.icon} className={tab.iconClass} />
          {editingId === tab.id ? (
            <input
              ref={inputRef}
              className="tab-title-input"
              value={draft}
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditingId(null);
              }}
            />
          ) : (
            <span>{tab.title}</span>
          )}
          {conn && !editingId && <span className="tab-conn">{conn.name}</span>}
          <span
            className="tab-close"
            title={`Close ${tab.title} (âW)`}
            aria-label={`Close ${tab.title}`}
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          >
            <Icon name="x" size={13} />
          </span>
        </button>
        );
      })}
      <button
        type="button"
        className="tab-add"
        title="New query tab (âN)"
        onClick={() => newQueryTab()}
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const id = draggedTabId(e);
          if (id) reorderTab(id, null);
          setDragId(null);
          setOverId(null);
        }}
      >
        <Icon name="plus" /><span>Query</span>
      </button>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            ...(tabs.find((t) => t.id === menu.id)?.kind === "query"
              ? [{
                  icon: "pencil" as const,
                  label: "Rename",
                  strong: true,
                  onClick: () => {
                    const tab = tabs.find((t) => t.id === menu.id);
                    setEditingId(menu.id);
                    setDraft(tab?.title ?? "");
                  },
                }]
              : []),
            { icon: "x" as const, label: "Close (âW)", onClick: () => closeTab(menu.id) },
            {
              icon: "rows" as const,
              label: "Close others",
              onClick: async () => {
                // sequential â dirty tabs each get their confirm dialog
                for (const t of tabs.filter((t) => t.id !== menu.id)) {
                  await closeTabWithConfirm(t.id);
                }
                activateTab(menu.id);
              },
            },
          ]}
        />
      )}
    </nav>
  );
}
