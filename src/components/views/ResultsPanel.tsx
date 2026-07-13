import { useMemo, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { JsonView } from "../../ui/JsonView";
import { Icon } from "../../ui/Icon";
import { SortTh } from "../../ui/SortTh";
import { useApp } from "../../store";
import { useActiveConnection } from "../../lib/queries";
import { esJson } from "../../lib/es";
import { formatValue, getPath, valueClass } from "../../lib/format";
import { runQueryTab } from "../../lib/runQuery";
import { sortRows, useSort } from "../../lib/useSort";

export function ResultsPanel({ tabId }: { tabId: string }) {
  const conn = useActiveConnection();
  const qt = useApp((s) => s.queryTabs[tabId]);
  const { selectDoc, selectedDoc, showToast, openDialog } = useApp();
  const [paths, setPaths] = useState<string[]>([]);
  const [pathInput, setPathInput] = useState("");
  // raw top-level columns by default; normalized JSON-path view is opt-in
  const [normalized, setNormalized] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { sort, cycleSort: rawCycleSort } = useSort();

  const result = qt?.result ?? null;
  const hits = result?.hits ?? null;

  const rawColumns = useMemo(() => {
    const cols = new Set<string>();
    for (const h of (hits ?? []).slice(0, 30)) {
      Object.keys(h._source).forEach((k) => cols.add(k));
    }
    return [...cols]; // all columns — the grid scrolls horizontally
  }, [hits]);

  const filteredHits = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query || !hits) return hits;
    return hits.filter((hit) => `${hit._id} ${JSON.stringify(hit._source)}`.toLowerCase().includes(query));
  }, [hits, filter]);

  // client-side sort over the loaded hits
  const sortedHits = useMemo(
    () => (filteredHits ? sortRows(filteredHits, sort, (h, col) => (col === "_id" ? h._id : getPath(h._source, col))) : filteredHits),
    [filteredHits, sort],
  );

  const total = sortedHits?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = (sortedHits ?? []).slice((safePage - 1) * pageSize, safePage * pageSize);

  const cycleSort = (col: string) => {
    setPage(1);
    rawCycleSort(col);
  };
  const allPageSelected = paged.length > 0 && paged.every((h) => selected.has(h._id));

  const columns = normalized ? paths : rawColumns;

  const addPath = () => {
    const p = pathInput.trim();
    if (!p) return;
    setPaths((prev) => (prev.includes(p) ? prev : [...prev, p]));
    setNormalized(true);
    setPathInput("");
  };

  const removePath = (p: string) => {
    setPaths((prev) => prev.filter((x) => x !== p));
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    if (!conn || !hits || selected.size === 0) return;
    const ok = await openDialog({
      kind: "confirm",
      title: "Delete documents",
      message: `Delete ${selected.size} document(s) from the cluster? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const targets = hits.filter((h) => selected.has(h._id));
    const ndjson =
      targets.map((h) => JSON.stringify({ delete: { _index: h._index, _id: h._id } })).join("\n") + "\n";
    try {
      await esJson(conn, "POST", "/_bulk?refresh=true", ndjson);
      showToast("Documents deleted", `${targets.length} document(s) removed.`);
      setSelected(new Set());
      void runQueryTab(tabId);
    } catch (err) {
      showToast("Bulk delete failed", String(err), "err");
    }
  };

  const copyNdjson = async () => {
    if (!hits?.length) return;
    await writeText(hits.map((h) => JSON.stringify(h._source)).join("\n"));
    showToast("Copied NDJSON", `${hits.length} documents copied to clipboard.`);
  };

  const meta = result
    ? result.error
      ? `error · ${result.error.slice(0, 80)}`
      : hits
        ? `${result.total ?? hits.length} hits · ${normalized ? "normalized preview" : "raw columns"} · ${result.timeMs}ms`
        : `HTTP ${result.status} · ${result.timeMs}ms`
    : "run the query to load results";

  return (
    <div className="results">
      <div className="result-head">
        <div className="result-headline">
          <div className="seg">
            <strong>Search Results</strong>
            <span className="result-meta">{meta}</span>
          </div>
          <div className="seg">
            {selected.size > 0 && (
              <ToolButton
                variant="danger"
                title="Delete selected documents from the cluster (_bulk)"
                onClick={() => void bulkDelete()}
              >
                <Icon name="trash" /> Delete {selected.size}
              </ToolButton>
            )}
            <ToolButton
              title={normalized ? "Switch to raw top-level columns" : "Switch to JSON-path columns"}
              onClick={() => setNormalized((n) => !n)}
            >
              <Icon name="table" /> {normalized ? "Normalized on" : "Raw columns"}
            </ToolButton>
            <ToolButton
              title="Copy all hits as NDJSON to clipboard"
              disabled={!hits?.length}
              onClick={() => void copyNdjson()}
            >
              <Icon name="copy" /> NDJSON
            </ToolButton>
          </div>
        </div>
        <div className="path-preview">
          <input
            className="path-input"
            value={filter}
            placeholder="Search loaded results"
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          />
          <input
            className="path-input"
            value={pathInput}
            placeholder="Add JSON path, e.g. payment.provider or fulfillment.state"
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addPath();
            }}
          />
          <ToolButton onClick={addPath}><Icon name="plus" /> Add path</ToolButton>
        </div>
      </div>
      <div className="result-grid">
        {result?.error && <div className="err-note">{result.error}</div>}
        {!result?.error && hits && (
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="row-check"
                    checked={allPageSelected}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelected((prev) => {
                        const next = new Set(prev);
                        paged.forEach((h) => (checked ? next.add(h._id) : next.delete(h._id)));
                        return next;
                      });
                    }}
                  />
                </th>
                <SortTh col="_id" sort={sort} onSort={cycleSort} title="Click to sort loaded hits: desc → asc → off">
                  _id
                </SortTh>
                {columns.map((c) => (
                  <SortTh
                    key={c}
                    col={c}
                    sort={sort}
                    onSort={cycleSort}
                    title="Click to sort loaded hits: desc → asc → off"
                  >
                    {c}
                    {normalized && (
                      <span
                        className="th-remove"
                        title="Remove column"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePath(c);
                        }}
                      >
                        <Icon name="x" size={13} />
                      </span>
                    )}
                  </SortTh>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((h) => (
                <tr
                  key={h._id}
                  className={selectedDoc?._id === h._id ? "selected" : ""}
                  onClick={() => selectDoc(h)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="row-check"
                      checked={selected.has(h._id)}
                      onChange={(e) => toggleRow(h._id, e.target.checked)}
                    />
                  </td>
                  <td><span className="cell-id">{h._id}</span></td>
                  {columns.map((c) => {
                    const value = getPath(h._source, c);
                    return (
                      <td
                        key={c}
                        title="Click: copy value"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectDoc(h, c);
                          void writeText(formatValue(value));
                          showToast("Copied", `${c} value copied.`);
                        }}
                      >
                        <span className={`path-value ${valueClass(c, value)}`}>{formatValue(value)}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} style={{ color: "var(--text-3)" }}>
                    no hits
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {!result?.error && !hits && result != null && <JsonView value={result.raw} />}
        {result == null && (
          <div className="empty-note">Press Run (⌘↵) to execute this request against the cluster.</div>
        )}
      </div>
      <div className="result-foot">
        <div className="seg">
          <ToolButton iconOnly disabled={safePage === 1} title="First page" aria-label="First page" onClick={() => setPage(1)}><Icon name="chevrons-left" /></ToolButton>
          <ToolButton iconOnly disabled={safePage === 1} title="Previous page" aria-label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))}><Icon name="arrow-left" /></ToolButton>
          <Badge>{safePage} / {totalPages}</Badge>
          <ToolButton iconOnly disabled={safePage === totalPages} title="Next page" aria-label="Next page" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><Icon name="arrow-right" /></ToolButton>
          <ToolButton iconOnly disabled={safePage === totalPages} title="Last page" aria-label="Last page" onClick={() => setPage(totalPages)}><Icon name="chevrons-right" /></ToolButton>
        </div>
        <div className="seg">
          <span>
            {total === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, total)} of {total}
          </span>
          <select
            className="page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 25, 50, 100].map((s) => (
              <option key={s} value={s}>{s}/page</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
