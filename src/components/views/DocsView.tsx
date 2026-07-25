import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { Icon } from "../../ui/Icon";
import { SectionVeil } from "../../ui/SectionVeil";
import { SortTh } from "../../ui/SortTh";
import { Combobox } from "../../ui/Combobox";
import { ColumnControls } from "../../ui/ColumnControls";
import { NoIndexState } from "../../ui/NoIndexState";
import { selectDocWithConfirm, useApp } from "../../store";
import { useActiveConnection, useIndices, useMappingFields } from "../../lib/queries";
import { esJson } from "../../lib/es";
import { formatDocCount, formatNumber, formatValue, getPath, valueClass } from "../../lib/format";
import { nextDocumentSearch } from "../../lib/documentSearch";
import { reorder, reorderVisible, syncColumnOrder } from "../../lib/columnOrder";
import type { EsHit } from "../../lib/types";

const PAGE_SIZE = 50;

type SortDir = "desc" | "asc";

export function DocsView({ tabId, active }: { tabId: string; active: boolean }) {
  const conn = useActiveConnection();
  const selectedDoc = useApp((s) => s.selectedDoc);
  const showToast = useApp((s) => s.showToast);
  const setDocsTabIndex = useApp((s) => s.setDocsTabIndex);
  const dt = useApp((s) => s.docsTabs[tabId]);
  const indices = useIndices();
  const index = dt?.index ?? "";
  const mapping = useMappingFields(index || null);
  const [filter, setFilter] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ field: string; dir: SortDir } | null>(null);
  const [normalized, setNormalized] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [enabledPaths, setEnabledPaths] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // reset per-connection search state when the active connection changes
  useEffect(() => {
    setFilter("");
    setApplied("");
    setPage(0);
    setSort(null);
    setNormalized(false);
    setPaths([]);
    setEnabledPaths(new Set());
    setColumnOrder([]);
    setHiddenColumns(new Set());
  }, [conn?.id]);

  // sort on .keyword subfield when the mapping says text + keyword
  const sortField = (col: string): string => {
    const f = mapping.data?.find((x) => x.path === col);
    if (f?.type.startsWith("text") && f.type.includes("keyword")) return `${col}.keyword`;
    return col;
  };

  const search = useQuery({
    queryKey: ["docs", conn?.id, index, applied, page, sort],
    enabled: !!conn && !!index,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const body = JSON.stringify({
        size: PAGE_SIZE,
        from: page * PAGE_SIZE,
        version: true,
        seq_no_primary_term: true,
        track_total_hits: true,
        ...(sort ? { sort: [{ [sortField(sort.field)]: { order: sort.dir } }] } : {}),
        query: applied.trim()
          ? { query_string: { query: applied.trim() } }
          : { match_all: {} },
      });
      const res = await esJson<any>(conn!, "POST", `/${encodeURIComponent(index)}/_search`, body);
      const total =
        typeof res.hits?.total === "number" ? res.hits.total : res.hits?.total?.value ?? 0;
      return { hits: (res.hits?.hits ?? []) as EsHit[], total: total as number };
    },
  });

  const hits = search.data?.hits ?? [];
  const total = search.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rawColumns = useMemo(() => {
    const cols = new Set<string>();
    for (const h of hits.slice(0, 20)) Object.keys(h._source ?? {}).forEach((k) => cols.add(k));
    return [...cols]; // all columns — the grid scrolls horizontally
  }, [hits]);

  // initialize / extend raw column order when the doc set changes
  useEffect(() => {
    setColumnOrder((prev) => syncColumnOrder(prev, rawColumns));
  }, [rawColumns]);
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

  if (!dt) return null;

  // click cycle: desc → asc → none
  const cycleSort = (col: string) => {
    setPage(0);
    setSort((s) => {
      if (s?.field !== col) return { field: col, dir: "desc" };
      if (s.dir === "desc") return { field: col, dir: "asc" };
      return null;
    });
  };

  const applyFilter = () => {
    const next = nextDocumentSearch(applied, filter, page);
    setApplied(next.applied);
    setPage(next.page);
    if (next.refetch) void search.refetch();
  };

  const addPath = (path: string) => {
    setPaths((current) => (current.includes(path) ? current : [...current, path]));
    setEnabledPaths((current) => new Set(current).add(path));
    setNormalized(true);
  };

  const removePath = (path: string) => {
    setPaths((current) => {
      const next = current.filter((p) => p !== path);
      if (next.length === 0) setNormalized(false);
      return next;
    });
    setEnabledPaths((current) => {
      const next = new Set(current);
      next.delete(path);
      return next;
    });
  };

  const togglePath = (path: string) => {
    setEnabledPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const enableAll = () => setEnabledPaths(new Set(paths));
  const disableAll = () => setEnabledPaths(new Set());

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

  return (
    <section className={`content docs-view ${active ? "active" : ""}`}>
      <div className="doc-head">
        <div className="seg">
          <Combobox
            id={`docs-index-${tabId}`}
            value={index}
            placeholder="Select index…"
            options={(indices.data ?? []).map((i) => ({ value: i.index, hint: i.health }))}
            onChange={(v) => setDocsTabIndex(tabId, v)}
          />
          {applied && <span>/ {applied}</span>}
          <Badge>{search.isFetching ? "loading…" : total ? `${formatDocCount(total)} docs` : ""}</Badge>
        </div>
        {/* the filter/column toolbar has nothing to act on until an index is picked */}
        {index && <div className="seg">
          <ToolButton
            iconOnly
            title={normalized ? "Show raw top-level columns" : "Show normalized JSON-path columns"}
            aria-label={normalized ? "Show raw top-level columns" : "Show normalized JSON-path columns"}
            onClick={() => setNormalized((value) => !value)}
          >
            <Icon name="table" />
          </ToolButton>
          <form
            id={`docs-search-${tabId}`}
            style={{ display: "contents" }}
            onSubmit={(e) => {
              e.preventDefault();
              applyFilter();
            }}
          >
            <input
              className="side-search"
              style={{ width: 250, height: 28 }}
              placeholder="customer.email:@acme.co"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <ToolButton type="submit" iconOnly title="Apply document filter" aria-label="Apply document filter">
              <Icon name="filter" />
            </ToolButton>
          </form>
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
        </div>}
      </div>
      {!index ? (
        <NoIndexState
          title="No index selected"
          hint="Pick one below to browse its documents — or open All Indexes for the full list."
          onPick={(i) => setDocsTabIndex(tabId, i)}
        />
      ) : (
      <div className="result-grid">
        {/* isLoading = first fetch with no data yet; placeholderData keeps later refetches veil-free */}
        <SectionVeil on={search.isLoading} label="Loading documents…" />
        {search.error && (
          <div className="err-note">
            {String(search.error)}
            <ToolButton title="Retry the search" onClick={() => void search.refetch()}>
              <Icon name="refresh" /> Retry
            </ToolButton>
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th>_id</th>
              {columns.map((c, idx) => (
                <SortTh
                  key={c}
                  col={c}
                  sort={sort ? { col: sort.field, dir: sort.dir } : null}
                  onSort={cycleSort}
                  title="Click to sort: desc → asc → off · drag to reorder"
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
                      onClick={(e) => {
                        e.stopPropagation();
                        removePath(c);
                      }}
                    >
                      <Icon name="x" size={12} />
                    </span>
                  )}
                </SortTh>
              ))}
            </tr>
          </thead>
          <tbody>
            {hits.map((h) => (
              <tr
                key={`${h._index}/${h._id}`}
                className={
                  selectedDoc && selectedDoc._index === h._index && selectedDoc._id === h._id
                    ? "selected"
                    : ""
                }
                onClick={() => void selectDocWithConfirm(h)}
              >
                <td><span className="cell-id">{h._id}</span></td>
                {columns.map((c) => {
                  const v = getPath(h._source ?? {}, c);
                  return (
                    <td
                      key={c}
                      title="Click: inspect · double-click: copy value"
                      onClick={(e) => {
                        e.stopPropagation();
                        void selectDocWithConfirm(h, c);
                      }}
                      onDoubleClick={() => {
                        void writeText(formatValue(v));
                        showToast("Copied", `${c} value copied.`);
                      }}
                    >
                      <span className={`path-value ${valueClass(c, v)}`}>{formatValue(v)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {!hits.length && !search.isFetching && (
              <tr><td colSpan={columns.length + 1} style={{ color: "var(--text-3)" }}>
                {applied ? "no documents match this filter" : "no documents"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
      {index && <div className="result-foot">
        <div className="seg">
          <ToolButton iconOnly disabled={page === 0} title="First page" aria-label="First page" onClick={() => setPage(0)}>
            <Icon name="chevrons-left" />
          </ToolButton>
          <ToolButton iconOnly disabled={page === 0} title="Previous 50 documents" aria-label="Previous page" onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <Icon name="arrow-left" />
          </ToolButton>
          <Badge>{page + 1} / {totalPages}</Badge>
          <ToolButton
            iconOnly
            disabled={page + 1 >= totalPages}
            title="Next 50 (from +50)"
            aria-label="Next page"
            onClick={() => setPage((p) => p + 1)}
          >
            <Icon name="arrow-right" />
          </ToolButton>
          <ToolButton iconOnly disabled={page + 1 >= totalPages} title="Last page" aria-label="Last page" onClick={() => setPage(totalPages - 1)}>
            <Icon name="chevrons-right" />
          </ToolButton>
        </div>
        <div className="seg">
          {sort && (
            <span>
              sort: {sort.field} {sort.dir}
            </span>
          )}
          <span>
            {total === 0 ? 0 : formatNumber(page * PAGE_SIZE + 1)}–{formatNumber(Math.min((page + 1) * PAGE_SIZE, total))} of {formatNumber(total)} · size {PAGE_SIZE}
          </span>
        </div>
      </div>}
    </section>
  );
}
