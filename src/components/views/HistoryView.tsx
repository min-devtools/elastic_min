import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { Icon } from "../../ui/Icon";
import { useApp } from "../../store";
import { runQueryTab } from "../../lib/runQuery";

function timeOf(at: number): string {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("en-GB")
    : `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function HistoryView({ active }: { active: boolean }) {
  const { history, clearHistory, newQueryTab, showToast } = useApp();

  const reopen = (i: number, run: boolean) => {
    const e = history[i];
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
          Every executed request lands here (max 200). Click to reopen, ▶ to re-run.
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
              <th>Time</th><th>Method</th><th>Path</th><th>Status</th><th>Took</th><th>Hits</th><th></th>
            </tr>
          </thead>
          <tbody>
            {history.map((e, i) => (
              <tr key={e.at + e.path} onClick={() => reopen(i, false)}>
                <td><span className="cell-date">{timeOf(e.at)}</span></td>
                <td><span className="type-pill">{e.method}</span></td>
                <td><span className="cell-id">{e.path}</span></td>
                <td>
                  <span className={e.status >= 400 || e.status === 0 ? "risk-high" : "risk-low"}>
                    {e.status || "ERR"}
                  </span>
                </td>
                <td><span className="cell-date">{e.timeMs}ms</span></td>
                <td>{e.hits ?? "—"}</td>
                <td onClick={(ev) => ev.stopPropagation()}>
                  <ToolButton title="Re-run now" onClick={() => reopen(i, true)}>
                    <Icon name="play" />
                  </ToolButton>
                </td>
              </tr>
            ))}
            {!history.length && (
              <tr><td colSpan={7} style={{ color: "var(--text-3)" }}>no queries executed yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
