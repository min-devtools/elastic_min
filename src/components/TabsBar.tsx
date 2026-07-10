import { useEffect, useRef, useState } from "react";
import { useApp } from "../store";
import { ContextMenu } from "../ui/ContextMenu";

export function TabsBar() {
  const { tabs, activeTabId, activateTab, closeTab, newQueryTab, renameTab } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const commit = () => {
    if (editingId) renameTab(editingId, draft);
    setEditingId(null);
  };

  return (
    <nav className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab ${tab.id === activeTabId ? "active" : ""}`}
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
          title={tab.kind === "query" ? "Double-click to rename · right-click for menu" : undefined}
        >
          <span className={tab.iconClass}>{tab.icon}</span>
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
          <span
            className="tab-close"
            title={`Close ${tab.title} (⌘W)`}
            aria-label={`Close ${tab.title}`}
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          >
            ×
          </span>
        </button>
      ))}
      <button type="button" className="tab-add" title="New query tab (⌘N)" onClick={() => newQueryTab()}>
        <span>＋</span><span>Query</span>
      </button>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            ...(tabs.find((t) => t.id === menu.id)?.kind === "query"
              ? [{
                  icon: "✎",
                  label: "Rename",
                  strong: true,
                  onClick: () => {
                    const tab = tabs.find((t) => t.id === menu.id);
                    setEditingId(menu.id);
                    setDraft(tab?.title ?? "");
                  },
                }]
              : []),
            { icon: "×", label: "Close (⌘W)", onClick: () => closeTab(menu.id) },
            {
              icon: "≡",
              label: "Close others",
              onClick: () => {
                for (const t of tabs.filter((t) => t.id !== menu.id)) closeTab(t.id);
                activateTab(menu.id);
              },
            },
          ]}
        />
      )}
    </nav>
  );
}
