import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Panel } from "../../ui/MetricPanel";
import { Badge } from "../../ui/Badge";
import { ToolButton } from "../../ui/ToolButton";
import { Icon } from "../../ui/Icon";
import { MiniTabs } from "../../ui/MiniTabs";
import { JsonEditor } from "../../ui/JsonEditor";
import { JsonView } from "../../ui/JsonView";
import { SectionVeil } from "../../ui/SectionVeil";
import { SortTh } from "../../ui/SortTh";
import { useApp } from "../../store";
import { useActiveConnection } from "../../lib/queries";
import { esJson } from "../../lib/es";
import { formatNumber } from "../../lib/format";
import { sortRows, useSort } from "../../lib/useSort";

interface TemplateEntry {
  name: string;
  patterns: string[];
  priority: number | null;
  body: unknown;
}

interface TemplateData {
  /** composable = /_index_template (ES 7.8+); legacy = /_template */
  kind: "composable" | "legacy";
  list: TemplateEntry[];
}

const NEW_TEMPLATE_SKELETON = `{
  "index_patterns": ["my-pattern-*"],
  "template": {
    "settings": { "number_of_shards": 1 },
    "mappings": { "properties": {} }
  }
}`;

interface IlmExplainRow {
  index: string;
  policy: string;
  phase: string;
  action: string;
  step: string;
}

export function TemplatesView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const queryClient = useQueryClient();
  const showToast = useApp((s) => s.showToast);
  const openDialog = useApp((s) => s.openDialog);
  const [tab, setTab] = useState("templates");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
  const { sort, cycleSort } = useSort();

  const templates = useQuery({
    queryKey: ["templates", conn?.id],
    enabled: !!conn,
    staleTime: 30_000,
    queryFn: async (): Promise<TemplateData> => {
      try {
        const res = await esJson<{ index_templates: { name: string; index_template: any }[] }>(
          conn!,
          "GET",
          "/_index_template",
        );
        return {
          kind: "composable",
          list: (res.index_templates ?? [])
            .map((t) => ({
              name: t.name,
              patterns: t.index_template?.index_patterns ?? [],
              priority: t.index_template?.priority ?? null,
              body: t.index_template,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        };
      } catch {
        // pre-7.8 clusters only speak the legacy endpoint
        const res = await esJson<Record<string, any>>(conn!, "GET", "/_template");
        return {
          kind: "legacy",
          list: Object.entries(res)
            .map(([name, body]) => ({
              name,
              patterns: body?.index_patterns ?? (body?.template ? [body.template] : []),
              priority: body?.order ?? null,
              body,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        };
      }
    },
  });

  const templateBase = templates.data?.kind === "legacy" ? "/_template" : "/_index_template";
  const current = templates.data?.list.find((t) => t.name === selected) ?? null;

  // load the picked template into the editor; discard the draft when switching away
  useEffect(() => {
    setDraft(current ? JSON.stringify(current.body, null, 2) : "");
  }, [selected, templates.data?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTemplate = async () => {
    if (!conn || !selected || saving) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (err) {
      showToast("Invalid JSON", String(err), "err");
      return;
    }
    setSaving(true);
    try {
      await esJson(conn, "PUT", `${templateBase}/${encodeURIComponent(selected)}`, JSON.stringify(parsed));
      showToast("Template saved", `${selected} updated on the cluster.`);
      void queryClient.invalidateQueries({ queryKey: ["templates", conn.id] });
    } catch (err) {
      showToast("Save failed", String(err), "err");
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async () => {
    if (!conn || !selected) return;
    const ok = await openDialog({
      kind: "confirm",
      title: "Delete template?",
      message: `"${selected}" will be removed from the cluster. Existing indexes keep their settings.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok === null) return;
    try {
      await esJson(conn, "DELETE", `${templateBase}/${encodeURIComponent(selected)}`);
      showToast("Template deleted", `${selected} removed.`);
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["templates", conn.id] });
    } catch (err) {
      showToast("Delete failed", String(err), "err");
    }
  };

  const newTemplate = async () => {
    const name = await openDialog({
      kind: "prompt",
      title: "New index template",
      message: "Template name:",
      confirmLabel: "Create",
    });
    if (!name?.trim()) return;
    setSelected(name.trim());
    setDraft(NEW_TEMPLATE_SKELETON);
  };

  const ilmPolicies = useQuery({
    queryKey: ["ilm-policies", conn?.id],
    enabled: !!conn && tab === "ilm",
    staleTime: 30_000,
    queryFn: () => esJson<Record<string, any>>(conn!, "GET", "/_ilm/policy"),
  });

  const ilmExplain = useQuery({
    queryKey: ["ilm-explain", conn?.id],
    enabled: !!conn && tab === "ilm",
    refetchInterval: 30_000,
    queryFn: async (): Promise<IlmExplainRow[]> => {
      const res = await esJson<{ indices: Record<string, any> }>(
        conn!,
        "GET",
        "/*/_ilm/explain?only_managed=true",
      );
      return Object.entries(res.indices ?? {}).map(([index, e]) => ({
        index,
        policy: e?.policy ?? "—",
        phase: e?.phase ?? "—",
        action: e?.action ?? "—",
        step: e?.step ?? "—",
      }));
    },
  });

  const policyNames = useMemo(
    () => Object.keys(ilmPolicies.data ?? {}).sort((a, b) => a.localeCompare(b)),
    [ilmPolicies.data],
  );
  const shownPolicy = selectedPolicy ?? policyNames[0] ?? null;
  const ilmRows = sortRows(ilmExplain.data ?? [], sort, (r, col) => {
    switch (col) {
      case "index": return r.index;
      case "policy": return r.policy;
      case "phase": return r.phase;
      case "action": return r.action;
      case "step": return r.step;
      default: return null;
    }
  });

  return (
    <section className={`content templates-view ${active ? "active" : ""}`}>
      <div className="doc-head">
        <MiniTabs
          tabs={[
            { id: "templates", label: "Index templates", icon: "template" },
            { id: "ilm", label: "ILM", icon: "history", title: "Index lifecycle management" },
          ]}
          active={tab}
          onChange={setTab}
        />
        {tab === "templates" && (
          <div className="seg" style={{ marginLeft: "auto" }}>
            <Badge>
              {templates.data
                ? `${formatNumber(templates.data.list.length)} · ${templates.data.kind}`
                : conn ? "loading…" : "no connection"}
            </Badge>
            <ToolButton variant="primary" onClick={() => void newTemplate()}>
              <Icon name="plus" /> New template
            </ToolButton>
          </div>
        )}
      </div>
      {!conn && <div className="empty-note" style={{ margin: 18 }}>Connect to a cluster first.</div>}

      {conn && tab === "templates" && (
        <div className="templates-layout">
          <div className="templates-list">
            <SectionVeil on={templates.isLoading} label="Loading templates…" />
            {templates.error && <div className="err-note">{String(templates.error)}</div>}
            {(templates.data?.list ?? []).map((t) => (
              <div
                key={t.name}
                className={`nav-item ${t.name === selected ? "active" : ""}`}
                onClick={() => setSelected(t.name)}
              >
                <Icon name="template" className="soft-blue" />
                <span title={t.patterns.join(", ")}>{t.name}</span>
                <span style={{ color: "var(--text-3)" }}>{t.patterns.join(", ") || "—"}</span>
              </div>
            ))}
            {templates.data && !templates.data.list.length && (
              <div className="empty-note">No templates on this cluster yet.</div>
            )}
          </div>
          <div className="templates-editor">
            {!selected && (
              <div className="empty-note" style={{ margin: 18 }}>
                Pick a template to view/edit its JSON, or create a new one.
              </div>
            )}
            {selected && (
              <>
                <div className="seg" style={{ padding: "8px 12px", gap: 8, borderBottom: "1px solid var(--line)" }}>
                  <strong>{selected}</strong>
                  <Badge>{templateBase.slice(1)}</Badge>
                  <span style={{ marginLeft: "auto" }} />
                  <ToolButton variant="danger" disabled={!current} title="Delete this template from the cluster" onClick={() => void deleteTemplate()}>
                    <Icon name="trash" /> Delete
                  </ToolButton>
                  <ToolButton variant="primary" disabled={saving} title={`PUT ${templateBase}/${selected}`} onClick={() => void saveTemplate()}>
                    <Icon name="save" /> {saving ? "Saving…" : current ? "Save changes" : "Create template"}
                  </ToolButton>
                </div>
                <div className="templates-editor-host">
                  <JsonEditor value={draft} onChange={setDraft} lineNumbers />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {conn && tab === "ilm" && (
        <div className="templates-ilm">
          <div className="cluster-main" style={{ position: "relative" }}>
            <SectionVeil on={ilmExplain.isLoading} label="Loading ILM state…" />
            {ilmExplain.error && (
              <div className="err-note">
                {String(ilmExplain.error)} — ILM needs Elasticsearch 6.6+ with the basic license
                (not available on OpenSearch).
              </div>
            )}
            <Panel title={`Managed indexes (${formatNumber(ilmExplain.data?.length ?? 0)})`}>
              <table>
                <thead>
                  <tr>
                    <SortTh col="index" sort={sort} onSort={cycleSort}>Index</SortTh>
                    <SortTh col="policy" sort={sort} onSort={cycleSort}>Policy</SortTh>
                    <SortTh col="phase" sort={sort} onSort={cycleSort}>Phase</SortTh>
                    <SortTh col="action" sort={sort} onSort={cycleSort}>Action</SortTh>
                    <SortTh col="step" sort={sort} onSort={cycleSort}>Step</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {ilmRows.map((r) => (
                    <tr key={r.index}>
                      <td><strong>{r.index}</strong></td>
                      <td>{r.policy}</td>
                      <td><span className="type-pill">{r.phase}</span></td>
                      <td>{r.action}</td>
                      <td>{r.step}</td>
                    </tr>
                  ))}
                  {!ilmRows.length && !ilmExplain.isLoading && (
                    <tr><td colSpan={5} style={{ color: "var(--text-3)" }}>no ILM-managed indexes</td></tr>
                  )}
                </tbody>
              </table>
            </Panel>
          </div>
          <Panel title="Policies" style={{ margin: "18px 18px 18px 0", overflow: "auto" }}>
            {ilmPolicies.error && <div className="err-note">{String(ilmPolicies.error)}</div>}
            {policyNames.length > 0 && (
              <>
                <select
                  className="side-search"
                  style={{ width: "100%", marginBottom: 10 }}
                  value={shownPolicy ?? ""}
                  onChange={(e) => setSelectedPolicy(e.target.value)}
                >
                  {policyNames.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                {shownPolicy && (
                  <JsonView className="json-tree" value={ilmPolicies.data?.[shownPolicy]?.policy ?? {}} />
                )}
              </>
            )}
            {!ilmPolicies.error && !policyNames.length && (
              <div className="empty-note">no ILM policies</div>
            )}
          </Panel>
        </div>
      )}
    </section>
  );
}
