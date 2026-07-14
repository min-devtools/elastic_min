import { useQuery } from "@tanstack/react-query";
import { Metric, Panel } from "../../ui/MetricPanel";
import { Kv } from "../../ui/Kv";
import { Badge } from "../../ui/Badge";
import { HealthPill } from "../../ui/Pills";
import { SortTh } from "../../ui/SortTh";
import { useApp } from "../../store";
import { useActiveConnection, useIndices } from "../../lib/queries";
import { esJson } from "../../lib/es";
import { formatBytes, formatDocCount } from "../../lib/format";
import { sortRows, useSort } from "../../lib/useSort";

interface ShardRow {
  shard: string;
  prirep: string;
  state: string;
  docs: string | null;
  store: string | null;
  node: string | null;
}

export function IndexStatsView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const indices = useIndices();
  const { activeIndex } = useApp();
  const index = activeIndex ?? conn?.defaultIndex ?? "";
  const info = indices.data?.find((i) => i.index === index);
  const { sort: shardSort, cycleSort: cycleShardSort } = useSort();

  const stats = useQuery({
    queryKey: ["index-stats", conn?.id, index],
    enabled: !!conn && !!index,
    refetchInterval: 10_000,
    queryFn: async () => {
      const [st, shards, settings] = await Promise.all([
        esJson<any>(conn!, "GET", `/${encodeURIComponent(index)}/_stats`),
        esJson<ShardRow[]>(
          conn!,
          "GET",
          `/_cat/shards/${encodeURIComponent(index)}?format=json&h=shard,prirep,state,docs,store,node`,
        ).catch(() => [] as ShardRow[]),
        esJson<any>(conn!, "GET", `/${encodeURIComponent(index)}/_settings`).catch(() => null),
      ]);
      return { st, shards, settings };
    },
  });

  const primaries = stats.data?.st?.indices?.[index]?.primaries ?? stats.data?.st?._all?.primaries;
  const totals = stats.data?.st?.indices?.[index]?.total ?? stats.data?.st?._all?.total;
  const idxSettings: any = stats.data?.settings
    ? (Object.values(stats.data.settings)[0] as any)?.settings?.index ?? {}
    : {};

  const searchTotal = totals?.search?.query_total ?? 0;
  const searchMs = totals?.search?.query_time_in_millis ?? 0;
  const indexTotal = totals?.indexing?.index_total ?? 0;
  const indexMs = totals?.indexing?.index_time_in_millis ?? 0;

  return (
    <section className={`content cluster-view ${active ? "active" : ""}`}>
      <div className="cluster-main">
        <div className="seg" style={{ marginBottom: 14, gap: 10 }}>
          <strong style={{ fontSize: "1.1538rem" }}>{index || "no index selected"}</strong>
          {info && <HealthPill health={info.health} />}
          {info?.aliases.length ? <Badge>aliases: {info.aliases.join(", ")}</Badge> : null}
          <Badge>{stats.isFetching ? "refreshing…" : "live · 10s"}</Badge>
        </div>
        {!index && <div className="empty-note">Pick an index in the sidebar, then open Index Stats.</div>}
        {stats.error && <div className="err-note">{String(stats.error)}</div>}
        <div className="dense-grid">
          <Metric label="Documents" value={primaries ? formatDocCount(primaries.docs?.count ?? 0) : "—"} />
          <Metric label="Deleted docs" value={primaries ? formatDocCount(primaries.docs?.deleted ?? 0) : "—"} />
          <Metric label="Primary size" value={primaries ? formatBytes(primaries.store?.size_in_bytes ?? 0) : "—"} />
          <Metric label="Total size" value={totals ? formatBytes(totals.store?.size_in_bytes ?? 0) : "—"} />
        </div>
        <div className="dense-grid">
          <Metric label="Search queries" value={formatDocCount(searchTotal)} />
          <Metric
            label="Avg search"
            value={searchTotal ? `${(searchMs / searchTotal).toFixed(1)}ms` : "—"}
          />
          <Metric label="Docs indexed" value={formatDocCount(indexTotal)} />
          <Metric
            label="Avg indexing"
            value={indexTotal ? `${(indexMs / indexTotal).toFixed(2)}ms` : "—"}
            color={indexTotal && indexMs / indexTotal > 5 ? "var(--orange)" : undefined}
          />
        </div>
        <Panel title={`Shards (${stats.data?.shards.length ?? 0})`}>
          <table>
            <thead>
              <tr>
                <SortTh col="shard" sort={shardSort} onSort={cycleShardSort}>Shard</SortTh>
                <SortTh col="role" sort={shardSort} onSort={cycleShardSort}>Role</SortTh>
                <SortTh col="state" sort={shardSort} onSort={cycleShardSort}>State</SortTh>
                <SortTh col="docs" sort={shardSort} onSort={cycleShardSort}>Docs</SortTh>
                <SortTh col="store" sort={shardSort} onSort={cycleShardSort}>Store</SortTh>
                <SortTh col="node" sort={shardSort} onSort={cycleShardSort}>Node</SortTh>
              </tr>
            </thead>
            <tbody>
              {sortRows(stats.data?.shards ?? [], shardSort, (s, col) => {
                switch (col) {
                  case "shard": return Number(s.shard);
                  case "role": return s.prirep;
                  case "state": return s.state;
                  case "docs": return s.docs != null && s.docs !== "" ? Number(s.docs) : null;
                  case "store": return s.store;
                  case "node": return s.node;
                  default: return null;
                }
              }).map((s, i) => (
                <tr key={i}>
                  <td>{s.shard}</td>
                  <td><span className="type-pill">{s.prirep === "p" ? "primary" : "replica"}</span></td>
                  <td>
                    <span className={s.state === "STARTED" ? "risk-low" : "risk-high"}>{s.state}</span>
                  </td>
                  <td>{s.docs ?? "—"}</td>
                  <td>{s.store ?? "—"}</td>
                  <td>{s.node ?? "—"}</td>
                </tr>
              ))}
              {!stats.data?.shards.length && (
                <tr><td colSpan={6} style={{ color: "var(--text-3)" }}>no shard info</td></tr>
              )}
            </tbody>
          </table>
        </Panel>
        <Panel title="Operations">
          <table>
            <tbody>
              <tr><td>get</td><td>{formatDocCount(totals?.get?.total ?? 0)}</td><td>{totals?.get?.time_in_millis ?? 0}ms total</td></tr>
              <tr><td>refresh</td><td>{formatDocCount(totals?.refresh?.total ?? 0)}</td><td>{totals?.refresh?.total_time_in_millis ?? 0}ms total</td></tr>
              <tr><td>merges</td><td>{formatDocCount(totals?.merges?.total ?? 0)}</td><td>{formatBytes(totals?.merges?.total_size_in_bytes ?? 0)} merged</td></tr>
              <tr><td>segments</td><td>{totals?.segments?.count ?? 0}</td><td>{formatBytes(totals?.segments?.memory_in_bytes ?? 0)} memory</td></tr>
            </tbody>
          </table>
        </Panel>
      </div>
      <Panel title="Settings" style={{ margin: "18px 18px 18px 0" }}>
        <Kv label="shards">{idxSettings.number_of_shards ?? "—"}</Kv>
        <Kv label="replicas">{idxSettings.number_of_replicas ?? "—"}</Kv>
        <Kv label="refresh">{idxSettings.refresh_interval ?? "1s (default)"}</Kv>
        <Kv label="created">
          {idxSettings.creation_date
            ? new Date(Number(idxSettings.creation_date)).toLocaleString("en-GB")
            : "—"}
        </Kv>
        <Kv label="uuid">{idxSettings.uuid ?? "—"}</Kv>
      </Panel>
    </section>
  );
}
