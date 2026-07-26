import { useMemo, useState } from "react";
import { Metric, Panel } from "../../ui/MetricPanel";
import { Badge } from "../../ui/Badge";
import { ToolButton } from "../../ui/ToolButton";
import { Icon } from "../../ui/Icon";
import { JsonView } from "../../ui/JsonView";
import { SortTh } from "../../ui/SortTh";
import { SectionVeil } from "../../ui/SectionVeil";
import { useApp } from "../../store";
import { useActiveConnection, useCatShards, type CatShardRow } from "../../lib/queries";
import { esRequest } from "../../lib/es";
import { formatNumber } from "../../lib/format";
import { sortRows, useSort } from "../../lib/useSort";

const BAD_STATES = new Set(["UNASSIGNED", "INITIALIZING", "RELOCATING"]);

export function ShardsView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const shards = useCatShards();
  const showToast = useApp((s) => s.showToast);
  const [filter, setFilter] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [explain, setExplain] = useState<{ title: string; body: unknown } | null>(null);
  const [explaining, setExplaining] = useState(false);
  const { sort, cycleSort } = useSort();

  const counts = useMemo(() => {
    const c = { STARTED: 0, RELOCATING: 0, INITIALIZING: 0, UNASSIGNED: 0 };
    for (const s of shards.data ?? []) {
      if (s.state in c) c[s.state as keyof typeof c]++;
    }
    return c;
  }, [shards.data]);

  const q = filter.trim().toLowerCase();
  const filtered = (shards.data ?? []).filter(
    (s) =>
      (!q || `${s.index} ${s.node ?? ""} ${s.state}`.toLowerCase().includes(q)) &&
      (!onlyProblems || s.state !== "STARTED"),
  );
  const rows = sortRows(filtered, sort, (s, col) => {
    switch (col) {
      case "index": return s.index;
      case "shard": return Number(s.shard);
      case "role": return s.prirep;
      case "state": return s.state;
      case "docs": return s.docs != null && s.docs !== "" ? Number(s.docs) : null;
      case "store": return s.store;
      case "node": return s.node;
      default: return null;
    }
  });

  /** POST _cluster/allocation/explain for a specific unassigned shard (or the first one). */
  const explainShard = async (row: CatShardRow | null) => {
    if (!conn || explaining) return;
    setExplaining(true);
    try {
      const body = row
        ? JSON.stringify({ index: row.index, shard: Number(row.shard), primary: row.prirep === "p" })
        : undefined;
      const res = await esRequest(conn, "POST", "/_cluster/allocation/explain", body);
      if (res.status >= 400) {
        const reason =
          (res.json as any)?.error?.reason ?? `HTTP ${res.status}`;
        showToast("Explain failed", reason, "err");
      } else {
        setExplain({
          title: row ? `${row.index} · shard ${row.shard} (${row.prirep === "p" ? "primary" : "replica"})` : "first unassigned shard",
          body: res.json,
        });
      }
    } catch (err) {
      showToast("Explain failed", String(err), "err");
    } finally {
      setExplaining(false);
    }
  };

  return (
    <section className={`content cluster-view ${active ? "active" : ""}`}>
      <div className="cluster-main">
        {!conn && <div className="empty-note">Connect to a cluster to see shard allocation.</div>}
        {shards.error && (
          <div className="err-note">
            {String(shards.error)}
            <ToolButton title="Reload shard list" onClick={() => void shards.refetch()}>
              <Icon name="refresh" /> Retry
            </ToolButton>
          </div>
        )}
        <div className="dense-grid">
          <Metric label="Started" value={formatNumber(counts.STARTED)} color="var(--green)" />
          <Metric label="Relocating" value={formatNumber(counts.RELOCATING)} color={counts.RELOCATING ? "var(--orange)" : undefined} />
          <Metric label="Initializing" value={formatNumber(counts.INITIALIZING)} color={counts.INITIALIZING ? "var(--orange)" : undefined} />
          <Metric label="Unassigned" value={formatNumber(counts.UNASSIGNED)} color={counts.UNASSIGNED ? "var(--red)" : undefined} />
        </div>
        <div className="seg" style={{ margin: "0 0 12px", gap: 10 }}>
          <input
            className="side-search"
            style={{ width: 260 }}
            placeholder="Filter by index, node, state…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <ToolButton
            className={onlyProblems ? "active" : ""}
            title="Show only shards that are not STARTED"
            onClick={() => setOnlyProblems((v) => !v)}
          >
            <Icon name="filter" /> Problems only
          </ToolButton>
          <ToolButton
            disabled={!conn || explaining || counts.UNASSIGNED === 0}
            title="POST /_cluster/allocation/explain for the first unassigned shard"
            onClick={() => void explainShard(null)}
          >
            <Icon name="zap" /> {explaining ? "Explaining…" : "Explain unassigned"}
          </ToolButton>
          <Badge>{formatNumber(filtered.length)} shown</Badge>
          <Badge>{shards.isFetching ? "refreshing…" : "live · 10s"}</Badge>
        </div>
        <Panel title="Shards">
          <div style={{ position: "relative", minHeight: 60 }}>
            <SectionVeil on={shards.isLoading} label="Loading shards…" />
            <table>
              <thead>
                <tr>
                  <SortTh col="index" sort={sort} onSort={cycleSort}>Index</SortTh>
                  <SortTh col="shard" sort={sort} onSort={cycleSort}>Shard</SortTh>
                  <SortTh col="role" sort={sort} onSort={cycleSort}>Role</SortTh>
                  <SortTh col="state" sort={sort} onSort={cycleSort}>State</SortTh>
                  <SortTh col="docs" sort={sort} onSort={cycleSort}>Docs</SortTh>
                  <SortTh col="store" sort={sort} onSort={cycleSort}>Store</SortTh>
                  <SortTh col="node" sort={sort} onSort={cycleSort}>Node</SortTh>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => (
                  <tr
                    key={`${s.index}-${s.shard}-${s.prirep}-${s.node ?? i}`}
                    style={s.state === "UNASSIGNED" ? { cursor: "pointer" } : undefined}
                    title={s.state === "UNASSIGNED" ? "Click: why is this shard unassigned?" : undefined}
                    onClick={s.state === "UNASSIGNED" ? () => void explainShard(s) : undefined}
                  >
                    <td><strong>{s.index}</strong></td>
                    <td>{s.shard}</td>
                    <td><span className="type-pill">{s.prirep === "p" ? "primary" : "replica"}</span></td>
                    <td>
                      <span className={BAD_STATES.has(s.state) ? "risk-high" : "risk-low"}>{s.state}</span>
                      {s["unassigned.reason"] ? (
                        <span style={{ color: "var(--text-3)", marginLeft: 6 }}>{s["unassigned.reason"]}</span>
                      ) : null}
                    </td>
                    <td>{formatNumber(s.docs)}</td>
                    <td>{s.store ?? "—"}</td>
                    <td>{s.node ?? "—"}</td>
                  </tr>
                ))}
                {!rows.length && !shards.isLoading && (
                  <tr><td colSpan={7} style={{ color: "var(--text-3)" }}>
                    {conn ? "no shards match" : "connect to a cluster first"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <Panel title="Allocation explain" style={{ margin: "18px 18px 18px 0", overflow: "auto" }}>
        {!explain && (
          <div className="empty-note">
            Click an UNASSIGNED shard (or “Explain unassigned”) to ask the cluster why it can't
            be allocated.
          </div>
        )}
        {explain && (
          <>
            <div className="seg" style={{ marginBottom: 10, gap: 8 }}>
              <Badge tone="red">{explain.title}</Badge>
              <ToolButton iconOnly title="Clear explanation" aria-label="Clear explanation" onClick={() => setExplain(null)}>
                <Icon name="x" />
              </ToolButton>
            </div>
            <JsonView className="json-tree" value={explain.body} />
          </>
        )}
      </Panel>
    </section>
  );
}
