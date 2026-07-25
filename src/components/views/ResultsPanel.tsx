import { useEffect, useMemo, useRef, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { motion, AnimatePresence } from "motion/react";
import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { JsonResponseViewer } from "../../ui/JsonResponseViewer";
import { SectionVeil } from "../../ui/SectionVeil";
import { Icon } from "../../ui/Icon";
import { SortTh } from "../../ui/SortTh";
import { ColumnControls } from "../../ui/ColumnControls";
import { selectDocWithConfirm, useApp } from "../../store";
import { useActiveConnection } from "../../lib/queries";
import { esJson } from "../../lib/es";
import { toggleQueryExpand } from "../ResizeHandles";
import { formatNumber, formatValue, getPath, valueClass } from "../../lib/format";
import { runQueryTab } from "../../lib/runQuery";
import { sortRows, useSort } from "../../lib/useSort";
import { reorder, reorderVisible, syncColumnOrder } from "../../lib/columnOrder";

export function ResultsPanel({ tabId }: { tabId: string }) {
  const conn = useActiveConnection();
  const qt = useApp((s) => s.queryTabs[tabId]);
  const selectedDoc = useApp((s) => s.selectedDoc);
  const showToast = useApp((s) => s.showToast);
  const openDialog = useApp((s) => s.openDialog);
  const [paths, setPaths] = useState<string[]>([]);
  const [enabledPaths, setEnabledPaths] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
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

  // read `view` inside the result effect without listing it as a dep — a dep would re-fire
  // the effect on a manual toggle and immediately force JSON back on
  const viewRef = useRef(view);
  viewRef.current = view;
  /** true while the JSON view was switched on for us by an aggregation result, not by the user */
  const autoJson = useRef(false);

  // new result = new doc set — stale selections would make "Copy/Delete N" lie
  useEffect(() => {
    setSelected(new Set());
    setPage(1);
    const rawObj = result?.raw as Record<string, unknown> | null;
    const hasAggs =
      !!rawObj && typeof rawObj === "object" && ("aggregations" in rawObj || "aggs" in rawObj);
    // aggregations have no rows to tabulate, so force JSON — but only the switch we made is
    // ours to undo, otherwise the next plain query would stomp a manual JSON toggle
    if (hasAggs) {
      if (viewRef.current === "table") {
        autoJson.current = true;
        setView("json");
      }
    } else if (autoJson.current) {
      autoJson.current = false;
      setView("table");
    }
  }, [result]);

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

  // initialize / extend raw column order when the result set changes
  useEffect(() => {
    setColumnOrder((prev) => syncColumnOrder(prev, rawColumns));
  }, [rawColumns]);

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

  const columns = normalized ? paths.filter((p) => enabledPaths.has(p)) : columnOrder.filter((c) => !hiddenColumns.has(c));

  const toggleColumn = (col: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const moveColumn = (from: number, to: number) => setColumnOrder((prev) => reorder(prev, from, to));

  const showAllColumns = () => setHiddenColumns(new Set());
  const hideAllColumns = () => setHiddenColumns(new Set(rawColumns));

  const movePath = (from: number, to: number) => setPaths((prev) => reorder(prev, from, to));

  // drag & drop reorder for table headers
  const headerDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };
  const headerDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };
  const headerDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndex;
    if (from !== null && from !== index) {
      // headers render only the visible columns — reorderVisible maps back past the hidden ones
      const apply = normalized ? setPaths : setColumnOrder;
      apply((prev) => reorderVisible(prev, columns, from, index));
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const headerDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const addPath = (p: string) => {
    setPaths((prev) => (prev.includes(p) ? prev : [...prev, p]));
    setEnabledPaths((prev) => new Set(prev).add(p));
    setNormalized(true);
  };

  const removePath = (p: string) => {
    setPaths((prev) => {
      const next = prev.filter((x) => x !== p);
      if (next.length === 0) setNormalized(false);
      return next;
    });
    setEnabledPaths((prev) => {
      const next = new Set(prev);
      next.delete(p);
      return next;
    });
  };

  const togglePath = (p: string) => {
    setEnabledPaths((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const enableAll = () => setEnabledPaths(new Set(paths));
  const disableAll = () => setEnabledPaths(new Set());

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

  const renderMeta = () => {
    if (!result) {
      return <span className="result-meta muted">run the query to load results</span>;
    }
    if (result.error) {
      return (
        <div className="result-meta-tags">
          <Badge tone="red">error · {result.error.slice(0, 80)}</Badge>
        </div>
      );
    }
    if (hits) {
      const hitCount = formatNumber(result.total ?? hits.length);
      return (
        <div className="result-meta-tags">
          <span className="result-hits-badge">
            <strong>{hitCount}</strong> hits
          </span>
          <span className="meta-dot">·</span>
          <Badge tone="idle">{normalized ? "normalized preview" : "raw columns"}</Badge>
          <span className="meta-dot">·</span>
          <span className="result-time-pill">{result.timeMs}ms</span>
        </div>
      );
    }
    return (
      <div className="result-meta-tags">
        <Badge tone="blue">HTTP {result.status}</Badge>
        <span className="meta-dot">·</span>
        <span className="result-time-pill">{result.timeMs}ms</span>
      </div>
    );
  };

  return (
    <div className="results">
      {/* double-click the chrome to collapse/expand the editor pane, but never steal a
          double-click that was aimed at an input, button or select inside the head */}
      <div
        className="result-head"
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("input, textarea, button, select, a")) return;
          toggleQueryExpand();
        }}
      >
        <div className="result-headline">
          <div className="seg">
            <strong>Search Results</strong>
            {renderMeta()}
          </div>
          <div className="seg">
            <AnimatePresence initial={false}>
              {selected.size > 0 && (
                <motion.span
                  key="bulk-actions"
                  layout
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: "auto" }}
                  exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  style={{ display: "flex", gap: 8, overflow: "hidden" }}
                >
                  <ToolButton
                    title="Copy selected documents as JSON"
                    onClick={() => void bulkCopy()}
                  >
                    <Icon name="copy" /> Copy {selected.size}
                  </ToolButton>
                  <ToolButton
                    variant="danger"
                    title="Delete selected documents from the cluster (_bulk)"
                    onClick={() => void bulkDelete()}
                  >
                    <Icon name="trash" /> Delete {selected.size}
                  </ToolButton>
                </motion.span>
              )}
            </AnimatePresence>
            <ToolButton
              title={normalized ? "Switch to raw top-level columns" : "Switch to JSON-path columns"}
              className={normalized && enabledPaths.size > 0 ? "active" : ""}
              disabled={paths.length === 0}
              onClick={() => setNormalized((n) => !n)}
            >
              <Icon name="table" /> {normalized ? "Normalized on" : "Raw columns"}
            </ToolButton>
            <ToolButton
              title={`Switch to ${view === "table" ? "JSON" : "table"} view`}
              onClick={() => {
                autoJson.current = false; // manual choice — the next result must not undo it
                setView((current) => (current === "table" ? "json" : "table"));
              }}
            >
              <Icon name={view === "table" ? "braces" : "table"} /> {view === "table" ? "JSON" : "Table"}
            </ToolButton>
          </div>
        </div>
        {view === "table" && (
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
            <ColumnControls
              columns={normalized ? paths : columnOrder}
              visibleColumns={columns}
              onToggle={normalized ? togglePath : toggleColumn}
              onMove={normalized ? movePath : moveColumn}
              onShowAll={normalized ? enableAll : showAllColumns}
              onHideAll={normalized ? disableAll : hideAllColumns}
              onAddPath={normalized ? addPath : undefined}
              paths={paths}
              enabledPaths={enabledPaths}
              onTogglePath={togglePath}
              onRemovePath={removePath}
            />
          </div>
        )}
      </div>
      <div className="result-grid">
        {/* running = a blocking user-initiated query run, not a background refetch */}
        <SectionVeil on={!!qt?.running} label="Running query…" />
        {result?.error && (
          <div className="err-note result-reveal" key={result.error}>
            {result.error}
            <ToolButton title="Run the query again" onClick={() => void runQueryTab(tabId)}>
              <Icon name="refresh" /> Retry
            </ToolButton>
          </div>
        )}
        {!result?.error && view === "table" && hits && (
          <table className="result-reveal" key={`${view}-${result?.timeMs ?? 0}`}>
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
                {columns.map((c, idx) => (
                  <SortTh
                    key={c}
                    col={c}
                    sort={sort}
                    onSort={cycleSort}
                    title="Click to sort loaded hits: desc → asc → off · drag to reorder"
                    draggable
                    className={`${dragIndex === idx ? "dragging" : ""} ${dragOverIndex === idx ? "drag-over" : ""}`}
                    onDragStart={headerDragStart(idx)}
                    onDragOver={headerDragOver(idx)}
                    onDrop={headerDrop(idx)}
                    onDragEnd={headerDragEnd}
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
        {/* no `result-reveal` + key on the host below: replaying that keyframe needs a remount,
            and the remount tears down and rebuilds the whole Monaco instance on every run */}
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
            {total === 0 ? 0 : formatNumber((safePage - 1) * pageSize + 1)}–{formatNumber(Math.min(safePage * pageSize, total))} of {formatNumber(total)}
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
