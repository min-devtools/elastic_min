import { Badge } from "../../ui/Badge";
import { ToolButton } from "../../ui/ToolButton";
import { Icon } from "../../ui/Icon";
import { connStyle } from "../../lib/connColor";
import { useApp } from "../../store";
import { useClusterOverview, type OverviewEntry } from "../../lib/queries";
import { formatBytes, formatDocCount, formatNumber } from "../../lib/format";
import { pressable } from "../../ui/pressable";

const STATUS_TONE = { green: "green", yellow: "yellow", red: "red" } as const;

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="overview-cell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function OverviewView({ active }: { active: boolean }) {
  const connections = useApp((s) => s.connections);
  const setActiveConn = useApp((s) => s.setActiveConn);
  const setEditingConn = useApp((s) => s.setEditingConn);
  const openTab = useApp((s) => s.openTab);
  const overview = useClusterOverview();
  const byId = new Map<string, OverviewEntry>((overview.data ?? []).map((e) => [e.connId, e]));

  return (
    <section className={`content overview-view ${active ? "active" : ""}`}>
      <div className="cluster-main">
        <div className="seg" style={{ marginBottom: 14, gap: 10 }}>
          <strong style={{ fontSize: "1.1538rem" }}>All clusters</strong>
          <Badge>{connections.length ? `${formatNumber(connections.length)} connections` : "none saved"}</Badge>
          {connections.length > 0 && <Badge>{overview.isFetching ? "refreshing…" : "live · 10s"}</Badge>}
        </div>
        {!connections.length && (
          <div className="empty-note">
            No saved connections yet.{" "}
            <ToolButton onClick={() => { setEditingConn(null); openTab("connection"); }}>
              <Icon name="plus" /> New Connection
            </ToolButton>
          </div>
        )}
        <div className="overview-grid">
          {connections.map((c) => {
            const e = byId.get(c.id);
            const status = e?.status ?? null;
            return (
              <div
                key={c.id}
                className={`overview-card ${status ?? ""}`}
                title="Click to switch to this connection"
                onClick={() => setActiveConn(c.id)}
                {...pressable(() => setActiveConn(c.id))}
              >
                <div className="overview-head">
                  <span className="conn-dot" style={connStyle(c.color)} />
                  <strong>{c.name}</strong>
                  <Badge tone={status ? STATUS_TONE[status] : "idle"}>
                    {status ?? (overview.isLoading ? "…" : e?.error ? "unreachable" : "—")}
                  </Badge>
                </div>
                <div className="overview-endpoint">{c.endpoint}</div>
                {e?.error ? (
                  <div className="overview-error" title={e.error}>{e.error}</div>
                ) : (
                  <div className="overview-cells">
                    <Cell label="nodes" value={formatNumber(e?.nodes ?? null)} />
                    <Cell label="indexes" value={formatNumber(e?.indices ?? null)} />
                    <Cell label="docs" value={e?.docs != null ? formatDocCount(e.docs) : "—"} />
                    <Cell label="size" value={e?.storeBytes != null ? formatBytes(e.storeBytes) : "—"} />
                    <Cell label="version" value={e?.versions.join(", ") || "—"} />
                    <Cell label="ping" value={e ? `${e.timeMs}ms` : "—"} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
