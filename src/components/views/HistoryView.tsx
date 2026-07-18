import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { Icon } from "../../ui/Icon";
import { SortTh } from "../../ui/SortTh";
import { useApp } from "../../store";
import { runQueryTab } from "../../lib/runQuery";
import { sortRows, useSort } from "../../lib/useSort";
import type { HistoryEntry } from "../../lib/types";
import { pressable } from "../../ui/pressable";

function timeOf(at: number): string {
  const diff = Date.now() - at;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const d = new Date(at);
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function HistoryView({ active }: { active: boolean }) {
  const history = useApp((s) => s.history);
  const clearHistory = useApp((s) => s.clearHistory);
  const newQueryTab = useApp((s) => s.newQueryTab);
  const showToast = useApp((s) => s.showToast);
  const activeConnName = useApp((s) => s.connections.find((c) => c.id === s.activeConnId)?.name);
  const { sort, cycleSort } = useSort();

  const sorted = sortRows(history, sort, (e, col) => {
    switch (col) {
      case "time": return e.at;
      case "method": return e.method;
      case "path": return e.path;
      case "status": return e.status;
      case "took": return e.timeMs;
      case "hits": return e.hits;
      default: return null;
    }
  });

  const reopen = (e: HistoryEntry, run: boolean) => {
    const id = newQueryTab({ method: e.method, path: e.path, body: e.body });
    if (run) void runQueryTab(id);
  };

  return (
    <section className={`content indexes-view ${active ? "active" : ""}`}>
      <div className="index-searchbar">
        <div className="seg">
          <strong>Query History</strong>
          <Badge>{history.length} runs</Badge>
        </div>
        <span />
        <span style={{ color: "var(--text-3)" }}>
          Every executed request lands here (max 200). Click to reopen, then use Run to execute again.
        </span>
        <ToolButton
          variant="danger"
          disabled={!history.length}
          onClick={() => {
            clearHistory();
            showToast("History cleared", "All recorded runs removed.");
          }}
        >
          <Icon name="trash" /> Clear
        </ToolButton>
      </div>
      <div className="index-table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh col="time" sort={sort} onSort={cycleSort}>Time</SortTh>
              <th>Connection</th>
              <SortTh col="method" sort={sort} onSort={cycleSort}>Method</SortTh>
              <SortTh col="path" sort={sort} onSort={cycleSort}>Path</SortTh>
              <SortTh col="status" sort={sort} onSort={cycleSort}>Status</SortTh>
              <SortTh col="took" sort={sort} onSort={cycleSort}>Took</SortTh>
              <SortTh col="hits" sort={sort} onSort={cycleSort}>Hits</SortTh>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => (
              <tr key={`${e.at}-${i}`} onClick={() => reopen(e, false)} {...pressable(() => reopen(e, false))}>
                <td><span className="cell-date" title={new Date(e.at).toLocaleString()}>{timeOf(e.at)}</span></td>
                <td>
                  <span
                    className={e.connName && e.connName !== activeConnName ? "risk-high" : undefined}
                    title={
                      e.connName && e.connName !== activeConnName
                        ? `Recorded on "${e.connName}" — re-running targets "${activeConnName ?? "no connection"}"`
                        : undefined
                    }
                  >
                    {e.connName ?? "—"}
                  </span>
                </td>
                <td><span className="type-pill">{e.method}</span></td>
                <td><span className="cell-id" title={e.body || undefined}>{e.path}</span></td>
                <td>
                  <span className={e.status >= 400 || e.status === 0 ? "risk-high" : "risk-low"}>
                    {e.status || "ERR"}
                  </span>
                </td>
                <td><span className="cell-date">{e.timeMs}ms</span></td>
                <td>{e.hits ?? "—"}</td>
                <td onClick={(ev) => ev.stopPropagation()}>
                  <ToolButton title="Re-run now" aria-label="Re-run query now" onClick={() => reopen(e, true)}>
                    <Icon name="play" />
                  </ToolButton>
                </td>
              </tr>
            ))}
            {!history.length && (
              <tr><td colSpan={8} style={{ color: "var(--text-3)" }}>no queries executed yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
