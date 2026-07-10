import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../store";
import { useIndices } from "../lib/queries";
import { runActiveQuery } from "../lib/runQuery";

interface Command {
  icon: string;
  label: string;
  kbd?: string;
  action: () => void;
}

export function CommandPalette() {
  const [input, setInput] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const indices = useIndices();
  const app = useApp();

  useEffect(() => {
    if (app.commandOpen) {
      setInput("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [app.commandOpen]);

  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      { icon: "▶", label: "Run current query", kbd: "⌘↵", action: runActiveQuery },
      { icon: "＋", label: "New query tab", kbd: "⌘N", action: () => app.newQueryTab() },
      { icon: "⌕", label: "Open Quick Query builder", action: () => app.openTab("quick-query") },
      { icon: "⎇", label: "New Elasticsearch connection", action: () => { app.setEditingConn(null); app.openTab("connection"); } },
      { icon: "▤", label: "Open Documents", kbd: "⌘D", action: () => app.openTab("docs") },
      { icon: "◨", label: "Toggle left sidebar", kbd: "⌘B", action: () => app.toggleLeft() },
      { icon: "◧", label: "Toggle right inspector", kbd: "⌘R", action: () => app.toggleRight() },
      { icon: "◧", label: "Open All Indexes", action: () => app.openTab("indexes") },
      { icon: "＋", label: "Create index", action: () => app.openTab("create-index") },
      { icon: "◌", label: "Show cluster health", action: () => app.openTab("cluster") },
      { icon: "⌬", label: "Open Mapping viewer", action: () => app.openTab("mapping") },
      { icon: "⚙", label: "Open Settings", kbd: "⌘,", action: () => app.openTab("settings") },
      { icon: "↺", label: "Open Query History", action: () => app.openTab("history") },
      { icon: "∿", label: "Index stats (active index)", action: () => app.openTab("index-stats") },
      { icon: "☾", label: "Toggle theme", action: () => app.toggleTheme() },
      { icon: "⌨", label: "Toggle vim mode", action: () => app.toggleVim() },
    ];
    for (const sq of app.savedQueries) {
      base.push({
        icon: "⌘",
        label: `Open saved query: ${sq.name}`,
        action: () => app.newQueryTab({ method: sq.method, path: sq.path, body: sq.body }),
      });
    }
    for (const c of app.connections) {
      base.push({
        icon: "⎇",
        label: `Switch connection: ${c.name}`,
        action: () => app.setActiveConn(c.id),
      });
    }
    for (const i of indices.data ?? []) {
      base.push({
        icon: "◧",
        label: `Open index: ${i.index}`,
        action: () => {
          app.setActiveIndex(i.index);
          app.openTab("docs");
        },
      });
    }
    return base;
  }, [app, indices.data]);

  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase();
    return (q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands).slice(0, 12);
  }, [commands, input]);

  if (!app.commandOpen) return null;

  const runCommand = (cmd: Command) => {
    app.setCommandOpen(false);
    cmd.action();
  };

  return (
    <div
      className="command"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) app.setCommandOpen(false);
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
            if (e.key === "Escape") app.setCommandOpen(false);
          }}
        />
        <div className="cmd-list">
          {filtered.map((cmd, i) => (
            <div
              key={cmd.label}
              className={`cmd ${i === cursor ? "active" : ""}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => runCommand(cmd)}
            >
              <span>{cmd.icon}</span>
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
