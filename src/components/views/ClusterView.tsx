import { Metric, Panel, BarLine } from "../../ui/MetricPanel";
import { Kv } from "../../ui/Kv";
import { Sparkline } from "../../ui/Sparkline";
import { ToolButton } from "../../ui/ToolButton";
import { Icon, type IconName } from "../../ui/Icon";
import {
  useActiveConnection,
  useClusterHealth,
  useClusterInfo,
  useClusterStats,
  useIndices,
  useNodeMetricSamples,
} from "../../lib/queries";
import { gaugeSeries, ratesPerSec } from "../../lib/metricsHistory";
import { formatDocCount, formatNumber } from "../../lib/format";
import { useApp } from "../../store";
import type { TabKind } from "../../lib/types";

// Nodes / Shards / Templates & ILM / Reindex / All Clusters used to be their own sidebar
// entries — now they're one click from here instead of cluttering the nav list.
const CLUSTER_LINKS: { kind: TabKind; icon: IconName; label: string }[] = [
  { kind: "nodes", icon: "server", label: "Nodes" },
  { kind: "shards", icon: "shards", label: "Shards" },
  { kind: "templates", icon: "template", label: "Templates & ILM" },
  { kind: "reindex", icon: "reindex", label: "Reindex" },
  { kind: "overview", icon: "globe", label: "All Clusters" },
];

function SparkCell({
  label,
  values,
  latest,
  color,
  max,
}: {
  label: string;
  values: number[];
  latest: string;
  color: string;
  max?: number;
}) {
  return (
    <div className="spark-cell">
      <div className="spark-head">
        <span>{label}</span>
        <strong style={{ color }}>{latest}</strong>
      </div>
      <Sparkline values={values} color={color} max={max} />
    </div>
  );
}

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
  const samples = useNodeMetricSamples();

  const heapSeries = gaugeSeries(samples, "heapPct");
  const cpuSeries = gaugeSeries(samples, "cpuPct");
  const indexRates = ratesPerSec(samples, "indexTotal");
  const searchRates = ratesPerSec(samples, "searchTotal");
  const fmtRate = (rates: number[]) =>
    rates.length ? `${formatNumber(Math.round(rates[rates.length - 1]))}/s` : "—";

  const h = health.data;
  const heapUsed = stats.data?.nodes?.jvm?.mem?.heap_used_in_bytes ?? 0;
  const heapMax = stats.data?.nodes?.jvm?.mem?.heap_max_in_bytes ?? 0;
  const heapPct = heapMax ? Math.round((heapUsed / heapMax) * 100) : null;
  const topIndices = (indices.data ?? []).slice(0, 5);

  return (
    <section className={`content cluster-view ${active ? "active" : ""}`}>
      <div className="cluster-main">
        <div className="seg" style={{ marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
          {CLUSTER_LINKS.map((l) => (
            <ToolButton key={l.kind} onClick={() => useApp.getState().openTab(l.kind)}>
              <Icon name={l.icon} /> {l.label}
            </ToolButton>
          ))}
        </div>
        {!conn && <div className="empty-note">Connect to a cluster to see live health.</div>}
        <div className="dense-grid">
          <Metric
            label="Cluster health"
            value={h ? h.status : "—"}
            color={h ? STATUS_COLORS[h.status] : undefined}
          />
          <Metric label="Nodes" value={formatNumber(h?.number_of_nodes)} />
          <Metric label="Active shards" value={formatNumber(h?.active_shards)} />
          <Metric
            label="Heap pressure"
            value={heapPct != null ? `${heapPct}%` : "—"}
            color={heapPct != null && heapPct > 75 ? "var(--red)" : heapPct != null && heapPct > 55 ? "var(--orange)" : undefined}
          />
        </div>
        <Panel title="Live metrics · 10s samples, 15m window">
          <div className="spark-grid">
            <SparkCell
              label="Heap"
              values={heapSeries}
              latest={heapSeries.length ? `${heapSeries[heapSeries.length - 1]}%` : "—"}
              color="var(--blue)"
              max={100}
            />
            <SparkCell
              label="CPU"
              values={cpuSeries}
              latest={cpuSeries.length ? `${cpuSeries[cpuSeries.length - 1]}%` : "—"}
              color="var(--orange)"
              max={100}
            />
            <SparkCell
              label="Indexing"
              values={indexRates}
              latest={fmtRate(indexRates)}
              color="var(--green)"
            />
            <SparkCell
              label="Search"
              values={searchRates}
              latest={fmtRate(searchRates)}
              color="var(--accent, var(--blue))"
            />
          </div>
        </Panel>
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
                <tr
                  key={i.index}
                  style={{ cursor: "pointer" }}
                  title="Open index stats"
                  onClick={() => {
                    useApp.getState().setActiveIndex(i.index);
                    useApp.getState().openTab("index-stats");
                  }}
                >
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
