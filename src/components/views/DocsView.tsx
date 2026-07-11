import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { Icon } from "../../ui/Icon";
import { SortTh } from "../../ui/SortTh";
import { useApp } from "../../store";
import { useActiveConnection, useMappingFields } from "../../lib/queries";
import { esJson } from "../../lib/es";
import { formatValue, getPath, valueClass } from "../../lib/format";
import type { EsHit } from "../../lib/types";

const PAGE_SIZE = 50;

type SortDir = "desc" | "asc";

export function DocsView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const { activeIndex, selectedDoc, selectDoc, showToast } = useApp();
  const index = activeIndex ?? conn?.defaultIndex ?? "";
  const mapping = useMappingFields(index || null);
  const [filter, setFilter] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ field: string; dir: SortDir } | null>(null);

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

  const columns = useMemo(() => {
    const cols = new Set<string>();
    for (const h of hits.slice(0, 20)) Object.keys(h._source).forEach((k) => cols.add(k));
    return [...cols]; // all columns — the grid scrolls horizontally
  }, [hits]);

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

  return (
    <section className={`content docs-view ${active ? "active" : ""}`}>
      <div className="doc-head">
        <div className="seg">
          <strong>Documents</strong>
          <span>{index ? `${index}${applied ? ` / ${applied}` : ""}` : "no index selected"}</span>
          <Badge>{search.isFetching ? "loading…" : total ? `${total} docs` : ""}</Badge>
        </div>
        <div className="seg">
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
          <ToolButton onClick={() => applyFilter(filter)}><Icon name="filter" /> Filter</ToolButton>
        </div>
      </div>
      <div className="result-grid">
        {search.error && <div className="err-note">{String(search.error)}</div>}
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
                </SortTh>
              ))}
            </tr>
          </thead>
          <tbody>
            {hits.map((h) => (
              <tr
                key={h._id}
                className={selectedDoc?._id === h._id ? "selected" : ""}
                onClick={() => selectDoc(h)}
              >
                <td><span className="cell-id">{h._id}</span></td>
                {columns.map((c) => {
                  const v = getPath(h._source, c);
                  return (
                    <td
                      key={c}
                      title="Click: inspect · double-click: copy value"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectDoc(h, c);
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
                {conn ? (index ? "no documents" : "select an index in the sidebar") : "no connection"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="result-foot">
        <div className="seg">
          <ToolButton disabled={page === 0} title="First page" onClick={() => setPage(0)}>
            «
          </ToolButton>
          <ToolButton disabled={page === 0} title="Previous 50 (from −50)" onClick={() => setPage((p) => Math.max(0, p - 1))}>
            ‹
          </ToolButton>
          <Badge>{page + 1} / {totalPages}</Badge>
          <ToolButton
            disabled={page + 1 >= totalPages}
            title="Next 50 (from +50)"
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </ToolButton>
          <ToolButton disabled={page + 1 >= totalPages} title="Last page" onClick={() => setPage(totalPages - 1)}>
            »
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
