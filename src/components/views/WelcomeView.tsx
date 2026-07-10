import { ToolButton } from "../../ui/ToolButton";
import { Icon } from "../../ui/Icon";
import { useApp } from "../../store";
import { useActiveConnection } from "../../lib/queries";

const STEPS = [
  { title: "1. Add endpoint", text: "Paste local, cloud or self-hosted Elasticsearch URL and choose an auth method." },
  { title: "2. Test handshake", text: "Run cluster health, version and permission checks before showing data." },
  { title: "3. Load objects", text: "Fetch indexes, aliases, templates, mappings and recent query history." },
  { title: "4. Continue work", text: "Open Query, Documents, All Indexes, or Create Index after the connection is ready." },
];

export function WelcomeView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const { openTab, setEditingConn, newQueryTab } = useApp();

  return (
    <section className={`content welcome-view ${active ? "active" : ""}`}>
      <div className="welcome-shell">
        <div className="welcome-hero">
          <div className="welcome-copy">
            <div className="welcome-kicker">
              {conn ? `connected · ${conn.name}` : "No active connection · new workspace"}
            </div>
            <h1 className="welcome-title">Welcome to ElasticMin</h1>
            <p className="welcome-text">
              Start by creating a connection to an Elasticsearch cluster. After the handshake
              succeeds, ElasticMin can load indexes, mappings, aliases and sample documents into
              this workspace.
            </p>
            <div className="welcome-actions">
              <ToolButton
                variant="primary"
                onClick={() => {
                  setEditingConn(null);
                  openTab("connection");
                }}
              >
                <Icon name="zap" /> New connection
              </ToolButton>
              <ToolButton onClick={() => newQueryTab()}>
                <Icon name="play" /> Open sample query
              </ToolButton>
            </div>
          </div>
          <div className="empty-index-map">
            <div>endpoint</div><code>https://localhost:9200</code>
            <div>auth</div><code>API key / basic / no auth</code>
            <div>test</div><code>GET /_cluster/health</code>
            <div>then</div><code>load indexes → pick index → query documents</code>
          </div>
        </div>
        <div className="welcome-panel">
          <div>
            <div className="welcome-kicker">First-run workflow</div>
            <h2 style={{ margin: "8px 0 0", fontSize: 18 }}>
              Connect first, then decide whether to query or create an index.
            </h2>
          </div>
          <div className="welcome-grid">
            {STEPS.map((s) => (
              <div className="welcome-step" key={s.title}>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
