import { useEffect, useMemo, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { JsonResponseViewer } from "../../ui/JsonResponseViewer";
import { SectionVeil } from "../../ui/SectionVeil";
import { Icon } from "../../ui/Icon";
import { SortTh } from "../../ui/SortTh";
import { selectDocWithConfirm, useApp } from "../../store";
import { useActiveConnection } from "../../lib/queries";
import { esJson } from "../../lib/es";
import { formatValue, getPath, valueClass } from "../../lib/format";
import { runQueryTab } from "../../lib/runQuery";
import { sortRows, useSort } from "../../lib/useSort";

export function ResultsPanel({ tabId }: { tabId: string }) {
  const conn = useActiveConnection();
  const qt = useApp((s) => s.queryTabs[tabId]);
  const selectedDoc = useApp((s) => s.selectedDoc);
  const showToast = useApp((s) => s.showToast);
  const openDialog = useApp((s) => s.openDialog);
  const [paths, setPaths] = useState<string[]>([]);
  const [pathInput, setPathInput] = useState("");
  // raw top-level columns by default; normalized JSON-path view is opt-in
  const [normalized, setNormalized] = useState(false);
  const [view, setView] = useState<"table" | "json">("table");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { sort, cycleSort: rawCycleSort } = useSort();

  const result = qt?.result ?? null;
  const hits = result?.hits ?? null;
  const showJson = view === "json" || !hits;

  // new result = new doc set — stale selections would make "Copy/Delete N" lie
  useEffect(() => {
    setSelected(new Set());
    setPage(1);
  }, [hits]);

  // docs across indices can share an _id — selection/keys must be index-qualified
  const keyOf = (h: { _index: string; _id: string }) => `${h._index}/${h._id}`;

  // same Monaco read-only viewer as the right dock / requests_min response pane —
  // only stringified when the JSON view is actually shown (10MB+ responses freeze otherwise)
  const rawJson = useMemo(
    () =>
      !showJson
        ? ""
        : typeof result?.raw === "string"
          ? result.raw
          : JSON.stringify(result?.raw ?? null, null, 2),
    [result?.raw, showJson],
  );

  const rawColumns = useMemo(() => {
    const cols = new Set<string>();
    for (const h of (hits ?? []).slice(0, 30)) {
      Object.keys(h._source ?? {}).forEach((k) => cols.add(k));
    }
    return [...cols]; // all columns — the grid scrolls horizontally
  }, [hits]);

  // lowercase haystack built once per result, not per filter keystroke
  const haystacks = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of hits ?? []) {
      m.set(keyOf(h), `${h._id} ${JSON.stringify(h._source ?? {})}`.toLowerCase());
    }
    return m;
  }, [hits]);

  const filteredHits = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query || !hits) return hits;
    return hits.filter((hit) => haystacks.get(keyOf(hit))?.includes(query));
  }, [hits, filter, haystacks]);

  // client-side sort over the loaded hits
  const sortedHits = useMemo(
    () => (filteredHits ? sortRows(filteredHits, sort, (h, col) => (col === "_id" ? h._id : getPath(h._source ?? {}, col))) : filteredHits),
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
  const allPageSelected = paged.length > 0 && paged.every((h) => selected.has(keyOf(h)));

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

  const bulkCopy = async () => {
    if (!hits || selected.size === 0) return;
    const targets = hits.filter((h) => selected.has(keyOf(h)));
    await writeText(JSON.stringify(targets, null, 2));
    showToast("Copied", `${targets.length} document(s) copied as JSON.`);
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
    const targets = hits.filter((h) => selected.has(keyOf(h)));
    const ndjson =
      targets.map((h) => JSON.stringify({ delete: { _index: h._index, _id: h._id } })).join("\n") + "\n";
    try {
      // _bulk returns HTTP 200 even when items fail — check per-item statuses
      const res = await esJson<{
        errors?: boolean;
        items?: { delete?: { _id?: string; status?: number; error?: { reason?: string } } }[];
      }>(conn, "POST", "/_bulk?refresh=true", ndjson);
      const failed = (res.items ?? []).filter((it) => (it.delete?.status ?? 0) >= 300);
      if (res.errors || failed.length > 0) {
        const first = failed[0]?.delete;
        showToast(
          "Bulk delete incomplete",
          `${failed.length}/${targets.length} failed${first?.error?.reason ? ` — ${first.error.reason}` : ""}.`,
          "err",
        );
      } else {
        showToast("Documents deleted", `${targets.length} document(s) removed.`);
      }
      setSelected(new Set());
      void runQueryTab(tabId);
    } catch (err) {
      showToast("Bulk delete failed", String(err), "err");
    }
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
                title="Copy selected documents as JSON"
                onClick={() => void bulkCopy()}
              >
                <Icon name="copy" /> Copy {selected.size}
              </ToolButton>
            )}
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
              title={`Switch to ${view === "table" ? "JSON" : "table"} view`}
              onClick={() => setView((current) => (current === "table" ? "json" : "table"))}
            >
              <Icon name={view === "table" ? "braces" : "table"} /> {view === "table" ? "JSON" : "Table"}
            </ToolButton>
          </div>
        </div>
        {view === "table" && <div className="path-preview">
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
        </div>}
      </div>
      <div className="result-grid">
        {/* running = a blocking user-initiated query run, not a background refetch */}
        <SectionVeil on={!!qt?.running} label="Running query…" />
        {result?.error && (
          <div className="err-note">
            {result.error}
            <ToolButton title="Run the query again" onClick={() => void runQueryTab(tabId)}>
              <Icon name="refresh" /> Retry
            </ToolButton>
          </div>
        )}
        {!result?.error && view === "table" && hits && (
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
                        paged.forEach((h) => (checked ? next.add(keyOf(h)) : next.delete(keyOf(h))));
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
                        aria-label="Remove column"
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
                  key={keyOf(h)}
                  className={
                    selectedDoc && keyOf(selectedDoc) === keyOf(h) ? "selected" : ""
                  }
                  onClick={() => void selectDocWithConfirm(h)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="row-check"
                      checked={selected.has(keyOf(h))}
                      onChange={(e) => toggleRow(keyOf(h), e.target.checked)}
                    />
                  </td>
                  <td><span className="cell-id">{h._id}</span></td>
                  {columns.map((c) => {
                    const value = getPath(h._source ?? {}, c);
                    return (
                      <td
                        key={c}
                        title="Click: inspect · double-click: copy value"
                        onClick={(e) => {
                          e.stopPropagation();
                          void selectDocWithConfirm(h, c);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
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
        {!result?.error && result != null && (view === "json" || !hits) && (
          <div className="result-editor-host">
            <JsonResponseViewer value={rawJson} />
          </div>
        )}
        {result == null && (
          <div className="empty-note">Press Run (⌘↵) to execute this request against the cluster.</div>
        )}
      </div>
      {view === "table" && <div className="result-foot">
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
      </div>}
    </div>
  );
}
