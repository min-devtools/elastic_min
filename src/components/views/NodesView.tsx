import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Metric, Panel } from "../../ui/MetricPanel";
import { Kv } from "../../ui/Kv";
import { Badge } from "../../ui/Badge";
import { ToolButton } from "../../ui/ToolButton";
import { Icon } from "../../ui/Icon";
import { SortTh } from "../../ui/SortTh";
import { SectionVeil } from "../../ui/SectionVeil";
import { useActiveConnection, useCatNodes } from "../../lib/queries";
import { esJson } from "../../lib/es";
import { parseNodeRoles } from "../../lib/nodes";
import { formatBytes, formatDocCount, formatNumber } from "../../lib/format";
import { sortRows, useSort } from "../../lib/useSort";

function pctColor(raw: string | null): string | undefined {
  const pct = Number(raw);
  if (raw == null || raw === "" || isNaN(pct)) return undefined;
  return pct > 75 ? "var(--red)" : pct > 55 ? "var(--orange)" : undefined;
}

function PctCell({ raw }: { raw: string | null }) {
  return (
    <td style={{ color: pctColor(raw) }}>
      {raw != null && raw !== "" ? `${raw}%` : "—"}
    </td>
  );
}

export function NodesView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const nodes = useCatNodes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { sort, cycleSort } = useSort();

  const rows = sortRows(nodes.data ?? [], sort, (n, col) => {
    switch (col) {
      case "name": return n.name;
      case "roles": return n["node.role"];
      case "version": return n.version;
      case "cpu": return n.cpu != null && n.cpu !== "" ? Number(n.cpu) : null;
      case "heap": return n["heap.percent"] != null ? Number(n["heap.percent"]) : null;
      case "ram": return n["ram.percent"] != null ? Number(n["ram.percent"]) : null;
      case "disk": return n["disk.used_percent"] != null ? Number(n["disk.used_percent"]) : null;
      case "load": return n.load_1m != null && n.load_1m !== "" ? Number(n.load_1m) : null;
      case "uptime": return n.uptime;
      default: return null;
    }
  });

  const selected = (nodes.data ?? []).find((n) => n.id === selectedId) ?? null;

  const detail = useQuery({
    queryKey: ["node-detail", conn?.id, selectedId],
    enabled: !!conn && !!selectedId,
    refetchInterval: 10_000,
    queryFn: () =>
      esJson<any>(conn!, "GET", `/_nodes/${encodeURIComponent(selectedId!)}/stats/jvm,os,fs,indices,process`),
  });
  const d = selectedId ? detail.data?.nodes?.[selectedId] : null;
  const heapUsed = d?.jvm?.mem?.heap_used_in_bytes ?? 0;
  const heapMax = d?.jvm?.mem?.heap_max_in_bytes ?? 0;
  const fsTotal = d?.fs?.total?.total_in_bytes ?? 0;
  const fsFree = d?.fs?.total?.available_in_bytes ?? 0;

  return (
    <section className={`content cluster-view ${active ? "active" : ""}`}>
      <div className="cluster-main">
        {!conn && <div className="empty-note">Connect to a cluster to list its nodes.</div>}
        {nodes.error && (
          <div className="err-note">
            {String(nodes.error)}
            <ToolButton title="Reload the node list" onClick={() => void nodes.refetch()}>
              <Icon name="refresh" /> Retry
            </ToolButton>
          </div>
        )}
        <div className="seg" style={{ marginBottom: 14, gap: 10 }}>
          <strong style={{ fontSize: "1.1538rem" }}>Nodes</strong>
          <Badge>{nodes.data ? `${formatNumber(nodes.data.length)} nodes` : conn ? "loading…" : "no connection"}</Badge>
          <Badge>{nodes.isFetching ? "refreshing…" : "live · 10s"}</Badge>
        </div>
        <Panel title="Cluster nodes">
          <div style={{ position: "relative", minHeight: 60 }}>
            <SectionVeil on={nodes.isLoading} label="Loading nodes…" />
            <table>
              <thead>
                <tr>
                  <SortTh col="name" sort={sort} onSort={cycleSort}>Name</SortTh>
                  <SortTh col="roles" sort={sort} onSort={cycleSort}>Roles</SortTh>
                  <SortTh col="version" sort={sort} onSort={cycleSort}>Version</SortTh>
                  <SortTh col="cpu" sort={sort} onSort={cycleSort}>CPU</SortTh>
                  <SortTh col="heap" sort={sort} onSort={cycleSort}>Heap</SortTh>
                  <SortTh col="ram" sort={sort} onSort={cycleSort}>RAM</SortTh>
                  <SortTh col="disk" sort={sort} onSort={cycleSort}>Disk used</SortTh>
                  <SortTh col="load" sort={sort} onSort={cycleSort}>Load 1m</SortTh>
                  <SortTh col="uptime" sort={sort} onSort={cycleSort}>Uptime</SortTh>
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => (
                  <tr
                    key={n.id}
                    className={n.id === selectedId ? "selected" : ""}
                    style={{ cursor: "pointer" }}
                    title="Click to inspect this node"
                    onClick={() => setSelectedId(n.id === selectedId ? null : n.id)}
                  >
                    <td>
                      <strong>{n.name}</strong>
                      {n.master === "*" && (
                        <span title="elected master" style={{ color: "var(--orange)", marginLeft: 6 }}>★</span>
                      )}
                      <div style={{ color: "var(--text-3)" }}>{n.ip ?? ""}</div>
                    </td>
                    <td>
                      <span className="type-pill" title={parseNodeRoles(n["node.role"]).join(", ")}>
                        {n["node.role"]}
                      </span>
                    </td>
                    <td>{n.version ?? "—"}</td>
                    <PctCell raw={n.cpu} />
                    <PctCell raw={n["heap.percent"]} />
                    <PctCell raw={n["ram.percent"]} />
                    <PctCell raw={n["disk.used_percent"]} />
                    <td>{n.load_1m ?? "—"}</td>
                    <td>{n.uptime ?? "—"}</td>
                  </tr>
                ))}
                {!rows.length && !nodes.isLoading && (
                  <tr><td colSpan={9} style={{ color: "var(--text-3)" }}>
                    {conn ? "no nodes reported" : "connect to a cluster first"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <Panel
        title={selected ? `Node · ${selected.name}` : "Node detail"}
        style={{ margin: "18px 18px 18px 0", overflow: "auto" }}
      >
        {!selected && <div className="empty-note">Click a node row to see its live stats.</div>}
        {selected && (
          <>
            <div className="dense-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Metric
                label="Heap"
                value={heapMax ? `${Math.round((heapUsed / heapMax) * 100)}%` : "—"}
                color={heapMax && heapUsed / heapMax > 0.75 ? "var(--red)" : undefined}
              />
              <Metric label="CPU" value={d?.os?.cpu?.percent != null ? `${d.os.cpu.percent}%` : "—"} />
            </div>
            <Kv label="Roles">{parseNodeRoles(selected["node.role"]).join(", ")}</Kv>
            <Kv label="Master">{selected.master === "*" ? "elected master" : "eligible/no"}</Kv>
            <Kv label="Heap used">{heapMax ? `${formatBytes(heapUsed)} / ${formatBytes(heapMax)}` : "—"}</Kv>
            <Kv label="Disk free">{fsTotal ? `${formatBytes(fsFree)} / ${formatBytes(fsTotal)}` : "—"}</Kv>
            <Kv label="Docs">{d ? formatDocCount(d.indices?.docs?.count ?? 0) : "—"}</Kv>
            <Kv label="Store">{d ? formatBytes(d.indices?.store?.size_in_bytes ?? 0) : "—"}</Kv>
            <Kv label="Open files">
              {d?.process?.open_file_descriptors != null
                ? `${formatNumber(d.process.open_file_descriptors)} / ${formatNumber(d.process.max_file_descriptors)}`
                : "—"}
            </Kv>
            <Kv label="Uptime">{selected.uptime ?? "—"}</Kv>
            <Kv label="Node id">{selected.id}</Kv>
            {detail.error ? <div className="err-note">{String(detail.error)}</div> : null}
          </>
        )}
      </Panel>
    </section>
  );
}
