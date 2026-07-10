import { useMemo } from "react";
import { useApp } from "../../store";
import { useActiveConnection, useRawMapping } from "../../lib/queries";
import { flattenMapping, mappingProperties } from "../../lib/es";

export function MappingView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const { activeIndex } = useApp();
  const index = activeIndex ?? conn?.defaultIndex ?? null;
  const raw = useRawMapping(index);

  const { fields, settings } = useMemo(() => {
    const data = raw.data;
    if (!data || !index) return { fields: [], settings: [] as [string, string][] };
    const mappingRoot: any = Object.values(data.mapping)[0];
    const fields = flattenMapping(mappingProperties(mappingRoot?.mappings));
    const settingsRoot: any = Object.values(data.settings)[0];
    const idx = settingsRoot?.settings?.index ?? {};
    const settings: [string, string][] = [
      ["number_of_shards", idx.number_of_shards ?? "—"],
      ["number_of_replicas", idx.number_of_replicas ?? "—"],
      ["refresh_interval", idx.refresh_interval ?? "1s (default)"],
      ["creation_date", idx.creation_date ? new Date(Number(idx.creation_date)).toISOString() : "—"],
    ];
    return { fields, settings };
  }, [raw.data, index]);

  const pad = (s: string) => s.padEnd(Math.max(22, s.length + 2), " ");

  return (
    <section className={`content mapping-view ${active ? "active" : ""}`}>
      <div className="doc-head">
        <strong>Mapping Viewer</strong>
        <span>{index ? `${index} · ${fields.length} fields` : "select an index in the sidebar"}</span>
      </div>
      {raw.error && <div className="err-note">{String(raw.error)}</div>}
      {!raw.error && (
        <pre className="json-tree">
          {index ? (
            <>
              {index}
              {"\n  properties\n"}
              {fields.map((f) => `    ${pad(f.path)}${f.type}\n`).join("")}
              {"  settings\n"}
              {settings.map(([k, v]) => `    ${pad(k)}${v}\n`).join("")}
            </>
          ) : (
            "no index selected"
          )}
        </pre>
      )}
    </section>
  );
}
