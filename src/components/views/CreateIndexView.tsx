import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ToolButton } from "../../ui/ToolButton";
import { FormRow } from "../../ui/FormRow";
import { JsonView } from "../../ui/JsonView";
import { Icon } from "../../ui/Icon";
import { useApp } from "../../store";
import { useActiveConnection } from "../../lib/queries";
import { esJson } from "../../lib/es";

const FIELD_TYPES = [
  "keyword", "text", "date", "long", "integer", "double", "scaled_float",
  "boolean", "ip", "geo_point", "nested", "object", "flattened",
];

interface MappingRow {
  path: string;
  type: string;
}

/** Build nested ES mapping properties from dotted paths. */
function buildProperties(rows: MappingRow[]): Record<string, any> {
  const root: Record<string, any> = {};
  for (const row of rows) {
    if (!row.path.trim()) continue;
    const parts = row.path.trim().split(".");
    let node = root;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        node[part] = row.type === "scaled_float"
          ? { type: "scaled_float", scaling_factor: 100 }
          : { type: row.type };
      } else {
        node[part] = node[part] ?? { properties: {} };
        node[part].properties = node[part].properties ?? {};
        node = node[part].properties;
      }
    });
  }
  return root;
}

export function CreateIndexView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const queryClient = useQueryClient();
  const { openTab, setActiveIndex, showToast } = useApp();
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [shards, setShards] = useState("1");
  const [replicas, setReplicas] = useState("1");
  const [refresh, setRefresh] = useState("1s");
  const [dynamic, setDynamic] = useState<"true" | "false" | "strict">("true");
  const [rows, setRows] = useState<MappingRow[]>([{ path: "", type: "keyword" }]);
  const [creating, setCreating] = useState(false);

  const body = useMemo(() => {
    const properties = buildProperties(rows);
    const out: Record<string, any> = {
      settings: {
        index: {
          number_of_shards: Number(shards) || 1,
          number_of_replicas: Number(replicas) || 0,
          refresh_interval: refresh || "1s",
        },
      },
    };
    if (alias.trim()) out.aliases = { [alias.trim()]: { is_write_index: true } };
    if (Object.keys(properties).length) {
      out.mappings = { dynamic, properties };
    }
    return out;
  }, [rows, shards, replicas, refresh, alias, dynamic]);

  const preview = `PUT /${name || "index-name"}\n${JSON.stringify(body, null, 2)}`;

  const validate = (): string | null => {
    if (!name.trim()) return "Index name is required.";
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
      return "Index name must be lowercase (letters, digits, . _ -) and not start with a symbol.";
    }
    const paths = rows.map((r) => r.path.trim()).filter(Boolean);
    if (new Set(paths).size !== paths.length) return "Duplicate mapping paths.";
    return null;
  };

  const patchRow = (i: number, patch: Partial<MappingRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const create = async () => {
    const err = validate();
    if (err) return showToast("Invalid definition", err, "warn");
    if (!conn) return showToast("No connection", "Connect to a cluster first.", "warn");
    setCreating(true);
    try {
      await esJson(conn, "PUT", `/${encodeURIComponent(name)}`, JSON.stringify(body));
      showToast("Index created", `${name} is ready${alias ? ` with alias ${alias}` : ""}.`);
      setActiveIndex(name);
      void queryClient.invalidateQueries({ queryKey: ["indices"] });
      openTab("indexes");
    } catch (e) {
      showToast("Create failed", String(e), "err");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className={`content create-index-view ${active ? "active" : ""}`}>
      <div className="create-head">
        <div>
          <div className="create-kicker">Create Elasticsearch index</div>
          <strong>Index settings, aliases and mapping preview</strong>
        </div>
        <div className="seg">
          <ToolButton
            onClick={() => {
              const err = validate();
              showToast(
                err ? "Invalid definition" : "Index definition valid",
                err ?? `${name} settings and mapping look good.`,
                err ? "warn" : "ok",
              );
            }}
          >
            <Icon name="check" /> Validate
          </ToolButton>
          <ToolButton variant="primary" disabled={creating} onClick={() => void create()}>
            <Icon name="plus" /> {creating ? "Creating…" : "Create index"}
          </ToolButton>
        </div>
      </div>
      <div className="create-layout">
        <div className="create-card">
          <h3>Definition</h3>
          <div className="create-form">
            <FormRow label="Index name">
              <input value={name} placeholder="orders-v5" onChange={(e) => setName(e.target.value)} />
            </FormRow>
            <FormRow label="Write alias">
              <input value={alias} placeholder="optional" onChange={(e) => setAlias(e.target.value)} />
            </FormRow>
            <FormRow label="Dynamic mapping">
              <select value={dynamic} onChange={(e) => setDynamic(e.target.value as typeof dynamic)}>
                <option value="true">true — index new fields</option>
                <option value="false">false — ignore new fields</option>
                <option value="strict">strict — reject new fields</option>
              </select>
            </FormRow>
            <div className="setting-row header"><span>Setting</span><span>Value</span><span /></div>
            <div className="setting-row">
              <span>number_of_shards</span>
              <input value={shards} onChange={(e) => setShards(e.target.value)} />
              <span />
            </div>
            <div className="setting-row">
              <span>number_of_replicas</span>
              <input value={replicas} onChange={(e) => setReplicas(e.target.value)} />
              <span />
            </div>
            <div className="setting-row">
              <span>refresh_interval</span>
              <input value={refresh} onChange={(e) => setRefresh(e.target.value)} />
              <span />
            </div>
            <div className="mapping-row header"><span>JSON path</span><span>Type</span><span /></div>
            {rows.map((row, i) => (
              <div className="mapping-row" key={i}>
                <input
                  value={row.path}
                  placeholder="customer.email"
                  onChange={(e) => patchRow(i, { path: e.target.value })}
                />
                <select value={row.type} onChange={(e) => patchRow(i, { type: e.target.value })}>
                  {FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <ToolButton iconOnly title="Remove field" aria-label="Remove field" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                  <Icon name="x" />
                </ToolButton>
              </div>
            ))}
            <div className="seg">
              <ToolButton onClick={() => setRows((rs) => [...rs, { path: "", type: "keyword" }])}>
                <Icon name="plus" /> Add field
              </ToolButton>
            </div>
          </div>
        </div>
        <div className="create-card">
          <h3>Request preview</h3>
          <JsonView className="create-preview json-tree" value={preview} />
        </div>
      </div>
    </section>
  );
}
