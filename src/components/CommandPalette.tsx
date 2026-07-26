import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { closeTabWithConfirm, useApp } from "../store";
import { useIndices } from "../lib/queries";
import { copyActiveQueryAsCurl, runActiveQuery } from "../lib/runQuery";
import { Icon, type IconName } from "../ui/Icon";
import { fuzzyMatch, highlight } from "../lib/fuzzy";
import { THEMES } from "../lib/themes";
import { ToolButton } from "../ui/ToolButton";

interface Command {
  icon: IconName;
  label: string;
  kbd?: string;
  action: () => void;
}

function renderHL(text: string, indices: number[]): ReactNode {
  if (!indices.length) return text;
  return highlight(text, indices).map((p, i) =>
    p.mark ? <mark key={i}>{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>,
  );
}

// ponytail: recents persisted in localStorage, max 3 shown.
const REC_KEY = "elasticmin:cmd-recents";
const REC_SHOW = 3;
const REC_KEEP = 8;
function readRecents(): string[] {
  try { return JSON.parse(localStorage.getItem(REC_KEY) ?? "[]") as string[]; } catch { return []; }
}
function pushRecent(label: string): void {
  const cur = readRecents().filter((l) => l !== label);
  cur.unshift(label);
  try { localStorage.setItem(REC_KEY, JSON.stringify(cur.slice(0, REC_KEEP))); } catch { /* ignore */ }
}

const RESULT_CAP = 30;

export function CommandPalette() {
  const [input, setInput] = useState("");
  const [cursor, setCursor] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const [themePicker, setThemePicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const indices = useIndices();
  const commandOpen = useApp((s) => s.commandOpen);
  const vimMode = useApp((s) => s.vimMode);
  const setCommandOpen = useApp((s) => s.setCommandOpen);
  const savedQueries = useApp((s) => s.savedQueries);
  const connections = useApp((s) => s.connections);
  const tabs = useApp((s) => s.tabs);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);

  useEffect(() => {
    if (commandOpen) {
      setInput("");
      setCursor(0);
      setRecents(readRecents());
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
      { icon: "docs", label: "Open Documents", kbd: "⌘⇧D", action: () => app.openTab("docs") },
      { icon: "panel-left", label: "Toggle left sidebar", kbd: "⌘B", action: () => app.toggleLeft() },
      { icon: "panel-right", label: "Toggle right inspector", kbd: "⌘R", action: () => app.toggleRight() },
      { icon: "indexes", label: "Open All Indexes", action: () => app.openTab("indexes") },
      { icon: "folder-plus", label: "Create index", action: () => app.openTab("create-index") },
      { icon: "cluster", label: "Show cluster health", action: () => app.openTab("cluster") },
      { icon: "server", label: "Show nodes", action: () => app.openTab("nodes") },
      { icon: "shards", label: "Show shard allocation", action: () => app.openTab("shards") },
      { icon: "globe", label: "All clusters overview", action: () => app.openTab("overview") },
      { icon: "template", label: "Open Templates & ILM", action: () => app.openTab("templates") },
      { icon: "reindex", label: "Open Reindex helper", action: () => app.openTab("reindex") },
      { icon: "mapping", label: "Open Mapping viewer", action: () => app.openTab("mapping") },
      { icon: "settings", label: "Open Settings", kbd: "⌘,", action: () => app.openTab("settings") },
      { icon: "history", label: "Open Query History", action: () => app.openTab("history") },
      { icon: "save", label: "Open Saved Queries", action: () => app.openTab("saved-queries") },
      { icon: "activity", label: "Index stats (active index)", action: () => app.openTab("index-stats") },
      { icon: "x", label: "Close current tab", kbd: "⌘W", action: () => void closeTabWithConfirm(useApp.getState().activeTabId) },
      { icon: "moon", label: "Toggle theme", action: () => app.toggleTheme() },
      { icon: "settings", label: "Theme picker", action: () => setThemePicker(true) },
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

  const filtered = useMemo<Array<Command & { labelIdx: number[]; recent: boolean }>>(() => {
    const q = input.trim();
    const mFor = (c: Command) => (q ? fuzzyMatch(q, c.label) : ({ indices: [] as number[], score: 0 } as const));

    const recentResolved = recents
      .map((l) => commands.find((c) => c.label === l))
      .filter((c): c is Command => !!c)
      .slice(0, REC_SHOW);
    const recentMatches = recentResolved
      .map((c) => ({ cmd: c, m: mFor(c) }))
      .filter((x) => !!x.m)
      .sort((a, b) => (b.m?.score ?? 0) - (a.m?.score ?? 0));
    const recentLabels = new Set(recentMatches.map((x) => x.cmd.label));

    const restMatches = commands
      .filter((c) => !recentLabels.has(c.label))
      .map((c) => ({ cmd: c, m: mFor(c) }))
      .filter((x) => !!x.m)
      .sort((a, b) => (b.m?.score ?? 0) - (a.m?.score ?? 0));

    const out: Array<Command & { labelIdx: number[]; recent: boolean }> = [];
    for (const x of recentMatches) out.push({ ...x.cmd, labelIdx: x.m!.indices, recent: true });
    for (const x of restMatches) out.push({ ...x.cmd, labelIdx: x.m!.indices, recent: false });
    return out.slice(0, RESULT_CAP);
  }, [commands, input, recents]);

  useEffect(() => {
    listRef.current
      ?.querySelector(".cmd.active")
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, filtered]);

  const runCommand = (cmd: Command) => {
    setCommandOpen(false);
    pushRecent(cmd.label);
    cmd.action();
  };

  return (
    <>
    <AnimatePresence>
      {commandOpen && (
        <motion.div
          key="command-palette-backdrop"
          className="command"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCommandOpen(false);
          }}
        >
          <motion.div
            key="command-palette-modal"
            className="palette"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
          >
            <input
              ref={inputRef}
              value={input}
              placeholder="Run command, open index, execute saved query..."
              onChange={(e) => {
                setInput(e.target.value);
                setCursor(0);
              }}
              onKeyDown={(e) => {
                const next = e.key === "Tab" || (vimMode && e.ctrlKey && e.key.toLowerCase() === "n");
                const previous = vimMode && e.ctrlKey && e.key.toLowerCase() === "p";
                if (e.key === "ArrowDown" || next) {
                  e.preventDefault();
                  setCursor((c) => Math.min(Math.max(0, filtered.length - 1), c + 1));
                }
                if (e.key === "ArrowUp" || previous) {
                  e.preventDefault();
                  setCursor((c) => Math.max(0, c - 1));
                }
                if (e.key === "Enter" && filtered[cursor]) runCommand(filtered[cursor]);
                if (e.key === "Escape") setCommandOpen(false);
              }}
            />
            <div className="cmd-list" ref={listRef}>
              {filtered.map((cmd, i) => (
                <Fragment key={cmd.label}>
                  {(i === 0 || filtered[i - 1].recent !== cmd.recent) && <div className="cmd-group">{cmd.recent ? "Recents" : "Commands"}</div>}
                  <div
                    className={`cmd ${i === cursor ? "active" : ""}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => runCommand(cmd)}
                  >
                    <Icon name={cmd.icon} size={15} />
                    <span>{renderHL(cmd.label, cmd.labelIdx)}</span>
                    {cmd.kbd ? <span className="kbd">{cmd.kbd}</span> : <span />}
                  </div>
                </Fragment>
              ))}
              {filtered.length === 0 && <div className="empty-note">No matching commands.</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <AnimatePresence>
      {themePicker && (
        <motion.div
          key="theme-picker-backdrop"
          className="modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setThemePicker(false); }}
        >
          <motion.div
            key="theme-picker-content"
            className="prompt-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Theme picker"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
          >
            <strong>Theme picker</strong>
            <p className="prompt-dialog-msg">Changes apply immediately and are saved for this device.</p>
            <select className="side-search" style={{ width: "100%" }} value={theme} autoFocus onChange={(event) => setTheme(event.target.value)}>
              <optgroup label="Dark">{THEMES.filter((item) => item.base === "dark").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>
              <optgroup label="Light">{THEMES.filter((item) => item.base === "light").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>
            </select>
            <div className="prompt-dialog-foot"><ToolButton variant="primary" onClick={() => setThemePicker(false)}>Done</ToolButton></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
