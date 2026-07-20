import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { Icon } from "../../ui/Icon";
import { SectionVeil } from "../../ui/SectionVeil";
import { SortTh } from "../../ui/SortTh";
import { Combobox } from "../../ui/Combobox";
import { selectDocWithConfirm, useApp } from "../../store";
import { useActiveConnection, useIndices, useMappingFields } from "../../lib/queries";
import { esJson } from "../../lib/es";
import { formatDocCount, formatValue, getPath, valueClass } from "../../lib/format";
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
  const [pathInput, setPathInput] = useState("");

  // reset per-connection search state when the active connection changes
  useEffect(() => {
    setFilter("");
    setApplied("");
    setPage(0);
    setSort(null);
    setNormalized(false);
    setPaths([]);
    setPathInput("");
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
  const columns = normalized ? paths : rawColumns;

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

  const applyFilter = (value: string) => {
    setApplied(value);
    setPage(0);
  };

  const addPath = () => {
    const path = pathInput.trim();
    if (!path) return;
    setPaths((current) => (current.includes(path) ? current : [...current, path]));
    setNormalized(true);
    setPathInput("");
  };

  return (
    <section className={`content docs-view ${active ? "active" : ""}`}>
      <div className="doc-head">
        <div className="seg">
          <strong>Documents</strong>
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
        <div className="seg">
          <ToolButton
            iconOnly
            title={normalized ? "Show raw top-level columns" : "Show normalized JSON-path columns"}
            aria-label={normalized ? "Show raw top-level columns" : "Show normalized JSON-path columns"}
            onClick={() => setNormalized((value) => !value)}
          >
            <Icon name="table" />
          </ToolButton>
          <input
            className="side-search"
            style={{ width: 250, height: 28 }}
            placeholder="customer.email:@acme.co"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilter(filter);
            }}
          />
          <ToolButton iconOnly title="Apply document filter" aria-label="Apply document filter" onClick={() => applyFilter(filter)}>
            <Icon name="filter" />
          </ToolButton>
          {normalized && (
            <>
              <input
                className="side-search"
                style={{ width: 220, height: 28 }}
                list="document-mapping-paths"
                placeholder="Add JSON path"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addPath();
                }}
              />
              <datalist id="document-mapping-paths">
                {(mapping.data ?? []).map((field) => <option key={field.path} value={field.path} />)}
              </datalist>
              <ToolButton iconOnly title="Add JSON path column" aria-label="Add JSON path column" onClick={addPath}>
                <Icon name="plus" />
              </ToolButton>
            </>
          )}
        </div>
      </div>
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
              {columns.map((c) => (
                <SortTh
                  key={c}
                  col={c}
                  sort={sort ? { col: sort.field, dir: sort.dir } : null}
                  onSort={cycleSort}
                  title="Click to sort: desc → asc → off"
                >
                  {c}
                  {normalized && (
                    <span
                      className="th-remove"
                      title="Remove column"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPaths((current) => current.filter((path) => path !== c));
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
                {conn ? (index ? "no documents" : "select an index above") : "no connection"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="result-foot">
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
            {total === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} · size {PAGE_SIZE}
          </span>
        </div>
      </div>
    </section>
  );
}
