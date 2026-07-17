import { useEffect, useMemo, useRef, useState } from "react";
import { closeTabWithConfirm, useApp } from "../store";
import { useIndices } from "../lib/queries";
import { copyActiveQueryAsCurl, runActiveQuery } from "../lib/runQuery";
import { Icon, type IconName } from "../ui/Icon";

interface Command {
  icon: IconName;
  label: string;
  kbd?: string;
  action: () => void;
}

/** True when q's characters appear in order inside label ("qq" → "Quick Query"). */
function fuzzyMatch(q: string, label: string): boolean {
  let i = 0;
  for (const ch of label) {
    if (ch === q[i]) i++;
    if (i >= q.length) return true;
  }
  return q.length === 0;
}

const RESULT_CAP = 30;

export function CommandPalette() {
  const [input, setInput] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const indices = useIndices();
  const commandOpen = useApp((s) => s.commandOpen);
  const setCommandOpen = useApp((s) => s.setCommandOpen);
  const savedQueries = useApp((s) => s.savedQueries);
  const connections = useApp((s) => s.connections);
  const tabs = useApp((s) => s.tabs);

  useEffect(() => {
    if (commandOpen) {
      setInput("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [commandOpen]);

  const commands = useMemo<Command[]>(() => {
    const app = useApp.getState();
    const base: Command[] = [
      { icon: "play", label: "Run current query", kbd: "⌘↵", action: runActiveQuery },
      { icon: "plus", label: "New query tab", kbd: "⌘N", action: () => app.newQueryTab() },
      { icon: "copy", label: "Copy query as curl", action: () => void copyActiveQueryAsCurl() },
      { icon: "quick-query", label: "Open Quick Query builder", action: () => app.openTab("quick-query") },
      { icon: "plug", label: "New Elasticsearch connection", action: () => { app.setEditingConn(null); app.openTab("connection"); } },
      { icon: "docs", label: "Open Documents", kbd: "⌘D", action: () => app.openTab("docs") },
      { icon: "panel-left", label: "Toggle left sidebar", kbd: "⌘B", action: () => app.toggleLeft() },
      { icon: "panel-right", label: "Toggle right inspector", kbd: "⌘R", action: () => app.toggleRight() },
      { icon: "indexes", label: "Open All Indexes", action: () => app.openTab("indexes") },
      { icon: "folder-plus", label: "Create index", action: () => app.openTab("create-index") },
      { icon: "cluster", label: "Show cluster health", action: () => app.openTab("cluster") },
      { icon: "mapping", label: "Open Mapping viewer", action: () => app.openTab("mapping") },
      { icon: "settings", label: "Open Settings", kbd: "⌘,", action: () => app.openTab("settings") },
      { icon: "history", label: "Open Query History", action: () => app.openTab("history") },
      { icon: "save", label: "Open Saved Queries", action: () => app.openTab("saved-queries") },
      { icon: "activity", label: "Index stats (active index)", action: () => app.openTab("index-stats") },
      { icon: "x", label: "Close current tab", kbd: "⌘W", action: () => void closeTabWithConfirm(useApp.getState().activeTabId) },
      { icon: "moon", label: "Toggle theme", action: () => app.toggleTheme() },
      { icon: "keyboard", label: "Toggle vim mode", action: () => app.toggleVim() },
    ];
    for (const t of tabs) {
      base.push({
        icon: t.icon,
        label: `Go to tab: ${t.title}`,
        action: () => app.activateTab(t.id),
      });
    }
    for (const sq of savedQueries) {
      base.push({
        icon: "save",
        label: `Open saved query: ${sq.name}`,
        action: () => app.newQueryTab({ method: sq.method, path: sq.path, body: sq.body }),
      });
    }
    for (const c of connections) {
      base.push({
        icon: "plug",
        label: `Switch connection: ${c.name}`,
        action: () => app.setActiveConn(c.id),
      });
    }
    for (const i of indices.data ?? []) {
      base.push({
        icon: "indexes",
        label: `Open index: ${i.index}`,
        action: () => {
          app.setActiveIndex(i.index);
          app.openTab("docs");
        },
      });
    }
    return base;
  }, [tabs, savedQueries, connections, indices.data]);

  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return commands.slice(0, RESULT_CAP);
    // substring matches rank above subsequence ("fuzzy") matches
    return commands
      .map((c) => {
        const l = c.label.toLowerCase();
        return { c, rank: l.includes(q) ? 0 : fuzzyMatch(q, l) ? 1 : -1 };
      })
      .filter((x) => x.rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .map((x) => x.c)
      .slice(0, RESULT_CAP);
  }, [commands, input]);

  useEffect(() => {
    listRef.current
      ?.querySelector(".cmd.active")
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, filtered]);

  if (!commandOpen) return null;

  const runCommand = (cmd: Command) => {
    setCommandOpen(false);
    cmd.action();
  };

  return (
    <div
      className="command"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setCommandOpen(false);
      }}
    >
      <div className="palette">
        <input
          ref={inputRef}
          value={input}
          placeholder="Run command, open index, execute saved query..."
          onChange={(e) => {
            setInput(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(filtered.length - 1, c + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(0, c - 1));
            }
            if (e.key === "Enter" && filtered[cursor]) runCommand(filtered[cursor]);
            if (e.key === "Escape") setCommandOpen(false);
          }}
        />
        <div className="cmd-list" ref={listRef}>
          {filtered.map((cmd, i) => (
            <div
              key={cmd.label}
              className={`cmd ${i === cursor ? "active" : ""}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => runCommand(cmd)}
            >
              <Icon name={cmd.icon} size={15} />
              <span>{cmd.label}</span>
              {cmd.kbd ? <span className="kbd">{cmd.kbd}</span> : <span />}
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-note">No matching commands.</div>}
        </div>
      </div>
    </div>
  );
}
