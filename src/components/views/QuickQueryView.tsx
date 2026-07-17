import { useEffect, useMemo, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { StatusDot } from "../../ui/StatusDot";
import { JsonView } from "../../ui/JsonView";
import { Icon } from "../../ui/Icon";
import { Combobox } from "../../ui/Combobox";
import { useApp } from "../../store";
import { useActiveConnection, useIndices, useMappingFields } from "../../lib/queries";
import { typedValue } from "../../lib/format";
import { runQueryTab } from "../../lib/runQuery";

type Operator = "term" | "match" | "range_gte" | "range_lte" | "exists";

const OPERATORS: { value: Operator; label: string }[] = [
  { value: "term", label: "term equals" },
  { value: "match", label: "match text" },
  { value: "range_gte", label: "range ≥" },
  { value: "range_lte", label: "range ≤" },
  { value: "exists", label: "exists" },
];

interface Condition {
  id: number;
  field: string;
  operator: Operator;
  value: string;
}

function defaultOperator(type: string): Operator {
  if (type.startsWith("date") || type.includes("float") || type.includes("long") || type.includes("integer") || type.includes("double")) {
    return "range_gte";
  }
  if (type.startsWith("text")) return "match";
  return "term";
}

function fieldNote(type: string): string {
  if (type.startsWith("keyword")) return "keyword field · exact values · fast filter cache";
  if (type.startsWith("text")) return "analyzed text · full-text match";
  if (type.startsWith("date")) return "date field · range friendly (now-7d, ISO)";
  if (type.includes("float") || type.includes("double")) return "numeric field · threshold filters";
  if (type.includes("long") || type.includes("integer")) return "numeric field · exact or range";
  if (type.startsWith("nested")) return "nested path · matches inside nested docs";
  return `${type} field`;
}

function clauseFor(c: Condition): Record<string, unknown> {
  const v = typedValue(c.value);
  switch (c.operator) {
    case "exists": return { exists: { field: c.field } };
    case "match": return { match: { [c.field]: v } };
    case "range_gte": return { range: { [c.field]: { gte: v } } };
    case "range_lte": return { range: { [c.field]: { lte: v } } };
    default: return { term: { [c.field]: v } };
  }
}

let nextId = 1;

export function QuickQueryView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const indices = useIndices();
  const activeIndex = useApp((s) => s.activeIndex);
  const setActiveIndex = useApp((s) => s.setActiveIndex);
  const newQueryTab = useApp((s) => s.newQueryTab);
  const showToast = useApp((s) => s.showToast);
  const openDialog = useApp((s) => s.openDialog);
  const index = activeIndex ?? conn?.defaultIndex ?? indices.data?.[0]?.index ?? "";
  const mapping = useMappingFields(index || null);
  const fields = mapping.data ?? [];

  const [conditions, setConditions] = useState<Condition[]>([]);
  const [logic, setLogic] = useState<"and" | "or">("and");
  const [lastField, setLastField] = useState("");

  // seed the first condition once the mapping arrives (or after index switch)
  useEffect(() => {
    if (fields.length && conditions.length === 0) {
      const f = fields[0];
      setConditions([{ id: nextId++, field: f.path, operator: defaultOperator(f.type), value: "" }]);
      setLastField(f.path);
    }
  }, [fields, conditions.length]);

  const patchCondition = (id: number, patch: Partial<Condition>) => {
    setConditions((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (patch.field) setLastField(patch.field);
  };

  const setConditionField = (id: number, path: string) => {
    const f = fields.find((x) => x.path === path);
    patchCondition(id, { field: path, ...(f ? { operator: defaultOperator(f.type) } : {}) });
  };

  const metaField = fields.find((f) => f.path === lastField) ?? fields[0];

  const query = useMemo(() => {
    const clauses = conditions.filter((c) => c.field).map(clauseFor);
    const q =
      clauses.length === 0
        ? { match_all: {} }
        : logic === "and"
          ? { bool: { filter: clauses } }
          : { bool: { should: clauses, minimum_should_match: 1 } };
    return { size: 50, track_total_hits: true, query: q };
  }, [conditions, logic]);

  const generated = JSON.stringify(query, null, 2);

  const useInQuery = () => {
    const id = newQueryTab({ method: "POST", path: `/${index}/_search`, body: generated });
    showToast("Quick query applied", `${conditions.length} condition(s) loaded into a Query tab.`);
    return id;
  };

  return (
    <section className={`content quick-query-view ${active ? "active" : ""}`}>
      <div className="quick-builder-head">
        <div className="seg">
          <StatusDot tone={conn ? "green" : "idle"} />
          <strong>Quick Query</strong>
          <span>{index ? `${index} mapping assisted filter` : "no index selected"}</span>
        </div>
        <div className="seg">
          <Badge>{mapping.isSuccess ? "mapping loaded" : mapping.isLoading ? "loading…" : "no mapping"}</Badge>
          <Badge>{fields.length} fields</Badge>
          <ToolButton variant="primary" disabled={!index} onClick={useInQuery}>
            <Icon name="arrow-right" /> Use in Query
          </ToolButton>
        </div>
      </div>
      <div className="quick-builder-body">
        <div className="quick-form">
          <div className="field-row">
            <label htmlFor="quick-index">Index</label>
            <Combobox
              id="quick-index"
              value={index}
              placeholder="Search index…"
              options={(indices.data ?? []).map((i) => ({ value: i.index, hint: `${i.health}` }))}
              onChange={async (v) => {
                if (v === index) return;
                if (conditions.some((c) => c.value)) {
                  const ok = await openDialog({
                    kind: "confirm",
                    title: "Switch index?",
                    message: "Current conditions will be cleared.",
                    confirmLabel: "Switch",
                  });
                  if (ok === null) return;
                }
                setActiveIndex(v);
                setConditions([]);
              }}
            />
          </div>

          <div className="field-row">
            <label>Conditions</label>
            <div className="logic-toggle">
              <button
                type="button"
                className={logic === "and" ? "active" : ""}
                title="All conditions must match (bool.filter)"
                onClick={() => setLogic("and")}
              >
                AND
              </button>
              <button
                type="button"
                className={logic === "or" ? "active" : ""}
                title="Any condition may match (bool.should)"
                onClick={() => setLogic("or")}
              >
                OR
              </button>
            </div>
          </div>

          {conditions.map((c, i) => (
            <div className="condition-card" key={c.id}>
              <div className="condition-head">
                <span>{i === 0 ? "WHERE" : logic.toUpperCase()}</span>
                <button
                  type="button"
                className="condition-remove"
                title="Remove condition"
                aria-label="Remove condition"
                  onClick={() => setConditions((cs) => cs.filter((x) => x.id !== c.id))}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
              <Combobox
                value={c.field}
                placeholder="Search field path…"
                options={fields.map((f) => ({ value: f.path, hint: f.type }))}
                onChange={(path) => setConditionField(c.id, path)}
              />
              <div className="condition-row">
                <select
                  value={c.operator}
                  onChange={(e) => patchCondition(c.id, { operator: e.target.value as Operator })}
                >
                  {OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input
                  value={c.value}
                  disabled={c.operator === "exists"}
                  placeholder="value, e.g. paid, now-7d, 100"
                  onChange={(e) => patchCondition(c.id, { value: e.target.value })}
                />
              </div>
            </div>
          ))}

          <div className="seg">
            <ToolButton
              disabled={!fields.length}
              onClick={() => {
                const f = fields.find((x) => x.path === lastField) ?? fields[0];
                setConditions((cs) => [
                  ...cs,
                  { id: nextId++, field: f?.path ?? "", operator: f ? defaultOperator(f.type) : "term", value: "" },
                ]);
              }}
            >
              <Icon name="plus" /> Add condition
            </ToolButton>
          </div>

          {metaField && (
            <div className="quick-field-meta">
              <strong>{metaField.path} · {metaField.type}</strong>
              <span>{fieldNote(metaField.type)}</span>
              <code>GET /{index}/_mapping → properties.{metaField.path}</code>
            </div>
          )}
        </div>
        <div className="quick-preview">
          <div className="quick-preview-head">
            <div className="seg">
              <strong>Generated request</strong>
              <span>POST /{index}/_search</span>
            </div>
            <div className="seg">
              <ToolButton
                onClick={() => {
                  void writeText(generated);
                  showToast("Quick query copied", "Filter copied as Elasticsearch JSON.");
                }}
              >
                <Icon name="copy" /> Copy
              </ToolButton>
              <ToolButton
                onClick={() => {
                  const id = useInQuery();
                  void runQueryTab(id);
                }}
              >
                <Icon name="play" /> Run preview
              </ToolButton>
            </div>
          </div>
          <JsonView className="quick-query-code json-tree" value={generated} />
          <div className="quick-mapping-strip">
            {fields.slice(0, 4).map((f) => (
              <div className="quick-map-card" key={f.path}>
                <strong>{f.path}</strong>
                <span>{f.type}</span>
                <span>{fieldNote(f.type)}</span>
              </div>
            ))}
            {!fields.length && <div className="empty-note">Mapping fields appear here.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
