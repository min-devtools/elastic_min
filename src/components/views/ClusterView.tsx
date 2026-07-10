import { Metric, Panel, BarLine } from "../../ui/MetricPanel";
import { Kv } from "../../ui/Kv";
import { useActiveConnection, useClusterHealth, useClusterInfo, useClusterStats, useIndices } from "../../lib/queries";
import { formatDocCount } from "../../lib/format";

const STATUS_COLORS: Record<string, string> = {
  green: "var(--green)",
  yellow: "var(--orange)",
  red: "var(--red)",
};

export function ClusterView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const health = useClusterHealth();
  const info = useClusterInfo();
  const stats = useClusterStats();
  const indices = useIndices();

  const h = health.data;
  const heapUsed = stats.data?.nodes?.jvm?.mem?.heap_used_in_bytes ?? 0;
  const heapMax = stats.data?.nodes?.jvm?.mem?.heap_max_in_bytes ?? 0;
  const heapPct = heapMax ? Math.round((heapUsed / heapMax) * 100) : null;
  const topIndices = (indices.data ?? []).slice(0, 5);

  return (
    <section className={`content cluster-view ${active ? "active" : ""}`}>
      <div className="cluster-main">
        {!conn && <div className="empty-note">Connect to a cluster to see live health.</div>}
        <div className="dense-grid">
          <Metric
            label="Cluster health"
            value={h ? h.status : "—"}
            color={h ? STATUS_COLORS[h.status] : undefined}
          />
          <Metric label="Nodes" value={h?.number_of_nodes ?? "—"} />
          <Metric label="Active shards" value={h?.active_shards ?? "—"} />
          <Metric
            label="Heap pressure"
            value={heapPct != null ? `${heapPct}%` : "—"}
            color={heapPct != null && heapPct > 75 ? "var(--red)" : heapPct != null && heapPct > 55 ? "var(--orange)" : undefined}
          />
        </div>
        <Panel title="Shards">
          <BarLine
            label="active"
            percent={h?.active_shards_percent_as_number ?? 0}
            value={`${Math.round(h?.active_shards_percent_as_number ?? 0)}%`}
          />
          <BarLine
            label="relocating"
            percent={h ? Math.min(100, h.relocating_shards * 10) : 0}
            value={String(h?.relocating_shards ?? 0)}
            color="var(--orange)"
          />
          <BarLine
            label="initializing"
            percent={h ? Math.min(100, h.initializing_shards * 10) : 0}
            value={String(h?.initializing_shards ?? 0)}
            color="var(--orange)"
          />
          <BarLine
            label="unassigned"
            percent={h ? Math.min(100, h.unassigned_shards * 10) : 0}
            value={String(h?.unassigned_shards ?? 0)}
            color="var(--red)"
          />
        </Panel>
        <Panel title="Largest indexes">
          <table>
            <tbody>
              {topIndices.map((i) => (
                <tr key={i.index}>
                  <td>{i.index}</td>
                  <td>primary shards {i.pri}</td>
                  <td>replicas {i.rep}</td>
                  <td>{formatDocCount(i.docsCount)} docs</td>
                  <td>{i.storeSize}</td>
                </tr>
              ))}
              {!topIndices.length && (
                <tr><td style={{ color: "var(--text-3)" }}>no indexes</td></tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>
      <Panel title="Connection" style={{ margin: "18px 18px 18px 0" }}>
        <Kv label="URL">{conn?.endpoint ?? "—"}</Kv>
        <Kv label="Cluster">{info.data?.cluster_name ?? "—"}</Kv>
        <Kv label="Version">{info.data?.version.number ?? "—"}</Kv>
        <Kv label="Auth">
          {conn ? (conn.authType === "apiKey" ? "API key" : conn.authType === "basic" ? "Basic auth" : "No auth") : "—"}
        </Kv>
        <Kv label="SSL">{conn ? (conn.insecure ? "self-signed allowed" : "verified") : "—"}</Kv>
      </Panel>
    </section>
  );
}
