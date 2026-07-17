import { ToolButton } from "../../ui/ToolButton";
import { Icon, type IconName } from "../../ui/Icon";
import { useApp } from "../../store";
import { useActiveConnection } from "../../lib/queries";

export function WelcomeView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const openTab = useApp((s) => s.openTab);
  const setEditingConn = useApp((s) => s.setEditingConn);
  const newQueryTab = useApp((s) => s.newQueryTab);

  const newConnection = () => {
    setEditingConn(null);
    openTab("connection");
  };

  const actions: { icon: IconName; label: string; desc: string; onClick: () => void }[] = [
    { icon: "play", label: "New query", desc: "Open a query tab and run search DSL.", onClick: () => newQueryTab() },
    { icon: "indexes", label: "Browse indexes", desc: "List indexes, sizes and doc counts.", onClick: () => openTab("indexes") },
    { icon: "folder-plus", label: "Create index", desc: "Define mappings and settings.", onClick: () => openTab("create-index") },
    { icon: "cluster", label: "Cluster health", desc: "Nodes, shards and status.", onClick: () => openTab("cluster") },
    { icon: "history", label: "Query history", desc: "Re-run what you ran before.", onClick: () => openTab("history") },
    { icon: "settings", label: "Settings", desc: "Theme, fonts and AI provider.", onClick: () => openTab("settings") },
  ];

  return (
    <section className={`content welcome-view ${active ? "active" : ""}`}>
      <div className="welcome-shell">
        <div className="welcome-hero">
          <div className="welcome-copy">
            <div className="welcome-kicker">
              {conn ? `connected · ${conn.name}` : "no active connection"}
            </div>
            <h1 className="welcome-title">ElasticMin</h1>
            <p className="welcome-text">
              {conn
                ? "You're connected. Jump straight into a query or browse your indexes."
                : "A tiny Elasticsearch client. Connect to a cluster to load indexes, mappings and documents."}
            </p>
            <div className="welcome-actions">
              <ToolButton variant="primary" onClick={conn ? () => newQueryTab() : newConnection}>
                <Icon name={conn ? "play" : "zap"} /> {conn ? "New query" : "New connection"}
              </ToolButton>
              <ToolButton onClick={conn ? newConnection : () => newQueryTab()}>
                <Icon name={conn ? "zap" : "play"} /> {conn ? "Manage connection" : "Try a query"}
              </ToolButton>
            </div>
          </div>
        </div>

        <div className="welcome-launch">
          {actions.map((a) => (
            <button type="button" className="welcome-card" key={a.label} onClick={a.onClick}>
              <span className="welcome-card-icon"><Icon name={a.icon} size={18} /></span>
              <strong>{a.label}</strong>
              <span className="welcome-card-desc">{a.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
