import { Icon } from "./Icon";
import { IndexDot } from "./Pills";
import { ToolButton } from "./ToolButton";
import { useApp } from "../store";
import { useActiveConnection, useIndices } from "../lib/queries";
import { formatDocCount } from "../lib/format";

const MAX_SUGGESTIONS = 8;

/**
 * Shown by index-scoped views (Documents, Mapping) when nothing is selected yet.
 * Doubles as the picker — landing here without having opened All Indexes first
 * used to leave a bare table with no way forward.
 */
export function NoIndexState({ title, hint, onPick }: { title: string; hint: string; onPick: (index: string) => void }) {
  const conn = useActiveConnection();
  const openTab = useApp((s) => s.openTab);
  const recency = useApp((s) => s.indexRecency);
  const indices = useIndices();

  if (!conn) {
    return (
      <div className="no-index-state">
        <Icon name="plug" size={26} />
        <h3>No cluster connected</h3>
        <p>Connect to an Elasticsearch cluster to browse its indexes.</p>
        <ToolButton onClick={() => openTab("connection")}><Icon name="plus" /> New connection</ToolButton>
      </div>
    );
  }

  const all = indices.data ?? [];
  // recent first so the list matches the sidebar's ordering, then everything else by name
  const rank = (name: string) => {
    const i = recency.indexOf(name);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const suggestions = [...all]
    .sort((a, b) => rank(a.index) - rank(b.index) || a.index.localeCompare(b.index))
    .slice(0, MAX_SUGGESTIONS);

  return (
    <div className="no-index-state">
      <Icon name="indexes" size={26} />
      <h3>{title}</h3>
      <p>{hint}</p>
      {indices.isLoading && <span className="no-index-loading">loading indexes…</span>}
      {!indices.isLoading && all.length === 0 && (
        <ToolButton onClick={() => openTab("create-index")}><Icon name="folder-plus" /> Create index</ToolButton>
      )}
      {suggestions.length > 0 && (
        <div className="no-index-picks">
          {suggestions.map((i) => (
            <button key={i.index} type="button" className="no-index-pick" onClick={() => onPick(i.index)}>
              <IndexDot health={i.health} />
              <span className="no-index-pick-name">{i.index}</span>
              <span className="no-index-pick-meta">{formatDocCount(i.docsCount)} docs</span>
            </button>
          ))}
        </div>
      )}
      {all.length > MAX_SUGGESTIONS && (
        <ToolButton onClick={() => openTab("indexes")}>
          <Icon name="indexes" /> Browse all {all.length} indexes
        </ToolButton>
      )}
    </div>
  );
}
