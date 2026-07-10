import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ToolButton } from "../../ui/ToolButton";
import { FormRow } from "../../ui/FormRow";
import { StatusDot, type DotTone } from "../../ui/StatusDot";
import { Icon } from "../../ui/Icon";
import { JsonView } from "../../ui/JsonView";
import { useApp } from "../../store";
import { esJson, esRequest } from "../../lib/es";
import type { AuthType, Connection } from "../../lib/types";

type CheckState = "idle" | "pending" | "ok" | "fail";

const CHECKS: { key: string; label: string; code: string }[] = [
  { key: "root", label: "Endpoint reachable", code: "GET /" },
  { key: "health", label: "Cluster health", code: "GET /_cluster/health" },
  { key: "indices", label: "Index permissions", code: "GET /_cat/indices" },
  { key: "mapping", label: "Mapping access", code: "GET /{index}/_mapping" },
];

const toneFor: Record<CheckState, DotTone> = { idle: "idle", pending: "orange", ok: "green", fail: "red" };

function draftFrom(conn: Connection | null): Connection {
  return (
    conn ?? {
      id: crypto.randomUUID(),
      name: "local-docker",
      endpoint: "https://localhost:9200",
      authType: "apiKey",
      apiKey: "",
      username: "",
      password: "",
      insecure: false,
      defaultIndex: "",
    }
  );
}

export function ConnectionView({ active }: { active: boolean }) {
  const queryClient = useQueryClient();
  const { connections, editingConnId, saveConnection, setActiveConn, openTab, closeTab, setEditingConn, showToast } = useApp();
  const editing = useMemo(
    () => connections.find((c) => c.id === editingConnId) ?? null,
    [connections, editingConnId],
  );
  const [draft, setDraft] = useState<Connection>(() => draftFrom(editing));
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const [preview, setPreview] = useState<unknown>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setDraft(draftFrom(editing));
    setChecks({});
    setPreview(null);
  }, [editingConnId, editing]);

  const patch = (p: Partial<Connection>) => setDraft((d) => ({ ...d, ...p }));

  const runHandshake = async (): Promise<boolean> => {
    setTesting(true);
    setChecks({ root: "pending", health: "pending", indices: "pending", mapping: "pending" });
    setPreview(null);
    let ok = true;
    const mark = (key: string, state: CheckState) =>
      setChecks((c) => ({ ...c, [key]: state }));
    try {
      const root = await esJson<any>(draft, "GET", "/");
      mark("root", "ok");
      try {
        const health = await esJson<any>(draft, "GET", "/_cluster/health");
        mark("health", "ok");
        let discovered: number | null = null;
        try {
          const indices = await esJson<any[]>(draft, "GET", "/_cat/indices?format=json&h=index");
          discovered = indices.length;
          mark("indices", "ok");
        } catch {
          mark("indices", "fail");
          ok = false;
        }
        if (draft.defaultIndex) {
          const res = await esRequest(draft, "GET", `/${encodeURIComponent(draft.defaultIndex)}/_mapping`);
          mark("mapping", res.status < 400 ? "ok" : "fail");
          if (res.status >= 400) ok = false;
        } else {
          mark("mapping", "ok");
        }
        setPreview({
          cluster_name: root.cluster_name,
          version: root.version?.number,
          status: health.status,
          discovered_indexes: discovered,
          default_index: draft.defaultIndex || null,
          next: "open query tab",
        });
      } catch (err) {
        mark("health", "fail");
        mark("indices", "fail");
        mark("mapping", "fail");
        setPreview({ error: String(err) });
        ok = false;
      }
    } catch (err) {
      setChecks({ root: "fail", health: "fail", indices: "fail", mapping: "fail" });
      setPreview({ error: String(err) });
      ok = false;
    } finally {
      setTesting(false);
    }
    return ok;
  };

  const save = async () => {
    const ok = await runHandshake();
    saveConnection(draft);
    setActiveConn(draft.id);
    void queryClient.invalidateQueries();
    if (draft.defaultIndex) useApp.getState().setActiveIndex(draft.defaultIndex);
    showToast(
      ok ? "Connection saved" : "Saved with warnings",
      ok
        ? `${draft.name} is now the active connection.`
        : `${draft.name} saved, but some handshake checks failed.`,
      ok ? "ok" : "warn",
    );
    if (ok) {
      // done with setup — close this tab instead of leaving it around
      setEditingConn(null);
      closeTab("connection");
      openTab("query");
    }
  };

  return (
    <section className={`content connection-view ${active ? "active" : ""}`}>
      <div className="create-head">
        <div>
          <div className="create-kicker">Connection setup</div>
          <strong>{editing ? `Edit connection · ${editing.name}` : "New Elasticsearch connection"}</strong>
        </div>
        <div className="seg">
          <ToolButton disabled={testing} onClick={() => void runHandshake()}>
            <Icon name="zap" /> {testing ? "Testing…" : "Test handshake"}
          </ToolButton>
          <ToolButton variant="primary" disabled={testing} onClick={() => void save()}>
            <Icon name="save" /> Save connection
          </ToolButton>
        </div>
      </div>
      <div className="create-layout">
        <div className="create-card">
          <h3>Endpoint and authentication</h3>
          <div className="create-form">
            <FormRow label="Name">
              <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
            </FormRow>
            <FormRow label="Endpoint">
              <input
                value={draft.endpoint}
                placeholder="https://localhost:9200"
                onChange={(e) => patch({ endpoint: e.target.value })}
              />
            </FormRow>
            <FormRow label="Auth method">
              <select
                value={draft.authType}
                onChange={(e) => patch({ authType: e.target.value as AuthType })}
              >
                <option value="apiKey">API key</option>
                <option value="basic">Basic auth</option>
                <option value="none">No auth</option>
              </select>
            </FormRow>
            {draft.authType === "apiKey" && (
              <FormRow label="API key">
                <input
                  type="password"
                  value={draft.apiKey ?? ""}
                  onChange={(e) => patch({ apiKey: e.target.value })}
                />
              </FormRow>
            )}
            {draft.authType === "basic" && (
              <>
                <FormRow label="Username">
                  <input value={draft.username ?? ""} onChange={(e) => patch({ username: e.target.value })} />
                </FormRow>
                <FormRow label="Password">
                  <input
                    type="password"
                    value={draft.password ?? ""}
                    onChange={(e) => patch({ password: e.target.value })}
                  />
                </FormRow>
              </>
            )}
            <FormRow label="TLS">
              <select
                value={draft.insecure ? "insecure" : "verify"}
                onChange={(e) => patch({ insecure: e.target.value === "insecure" })}
              >
                <option value="verify">Verify certificate</option>
                <option value="insecure">Allow self-signed locally</option>
              </select>
            </FormRow>
            <FormRow label="Default index">
              <input
                value={draft.defaultIndex ?? ""}
                placeholder="optional"
                onChange={(e) => patch({ defaultIndex: e.target.value })}
              />
            </FormRow>
            <div className="connection-note">
              <strong>First-run behavior</strong>
              <span>
                Saving this connection loads cluster health, index list, mappings and aliases
                before enabling query/document work.
              </span>
            </div>
          </div>
        </div>
        <div className="create-card">
          <h3>Handshake checks</h3>
          <div className="create-form">
            {CHECKS.map((c) => (
              <div className="check-row" key={c.key}>
                <StatusDot tone={toneFor[checks[c.key] ?? "idle"]} />
                <strong>{c.label}</strong>
                <code>
                  {c.key === "mapping" && draft.defaultIndex
                    ? `GET /${draft.defaultIndex}/_mapping`
                    : c.code}
                </code>
              </div>
            ))}
            {preview != null ? (
              <JsonView className="create-preview json-tree" value={preview} />
            ) : (
              <pre className="create-preview">Run “Test handshake” to check the endpoint.</pre>
            )}
            <div className="seg">
              <ToolButton onClick={() => useApp.getState().newQueryTab()}>Open new query tab</ToolButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
