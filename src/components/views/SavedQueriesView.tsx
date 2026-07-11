import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { Icon } from "../../ui/Icon";
import { useApp } from "../../store";
import type { SavedQuery } from "../../lib/types";

function timeOf(at: number): string {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("en-GB")
    : `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function SavedQueriesView({ active }: { active: boolean }) {
  const { savedQueries, newQueryTab, deleteSavedQuery, renameSavedQuery, showToast, openDialog } = useApp();

  const reopen = (q: SavedQuery) => newQueryTab({ method: q.method, path: q.path, body: q.body });

  return (
    <section className={`content indexes-view ${active ? "active" : ""}`}>
      <div className="index-searchbar">
        <div className="seg">
          <strong>Saved Queries</strong>
          <Badge>{savedQueries.length} saved</Badge>
        </div>
        <span />
        <span style={{ color: "var(--text-3)" }}>
          Save a query tab with ⌘S. Click a row to reopen it in a new query tab.
        </span>
      </div>
      <div className="index-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Method</th>
              <th>Path</th>
              <th>Saved</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {savedQueries.map((q) => (
              <tr key={q.id} onClick={() => reopen(q)}>
                <td><span className="cell-id">{q.name}</span></td>
                <td><span className="type-pill">{q.method}</span></td>
                <td><span className="cell-id">{q.path}</span></td>
                <td><span className="cell-date">{timeOf(q.createdAt)}</span></td>
                <td onClick={(e) => e.stopPropagation()}>
                  <ToolButton
                    title="Rename"
                    onClick={async () => {
                      const name = await openDialog({
                        kind: "prompt",
                        title: "Rename saved query",
                        defaultValue: q.name,
                        confirmLabel: "Rename",
                      });
                      if (name?.trim()) renameSavedQuery(q.id, name);
                    }}
                  >
                    <Icon name="pencil" />
                  </ToolButton>
                  <ToolButton
                    title="Delete"
                    onClick={() => {
                      deleteSavedQuery(q.id);
                      showToast("Saved query deleted", "Removed from this workspace.");
                    }}
                  >
                    <Icon name="trash" />
                  </ToolButton>
                </td>
              </tr>
            ))}
            {!savedQueries.length && (
              <tr><td colSpan={5} style={{ color: "var(--text-3)" }}>no saved queries yet — press ⌘S in a query tab</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
