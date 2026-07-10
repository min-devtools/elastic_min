import { useEffect, useRef, useState } from "react";
import { useApp } from "../store";

export function TabsBar() {
  const { tabs, activeTabId, activateTab, closeTab, newQueryTab, renameTab } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
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
          onDoubleClick={() => {
            if (tab.kind !== "query") return;
            setEditingId(tab.id);
            setDraft(tab.title);
          }}
          title={tab.kind === "query" ? "Double-click to rename" : undefined}
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
    </nav>
  );
}
