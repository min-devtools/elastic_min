import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../../store";
import { useActiveConnection, useIndices, useRawMapping } from "../../lib/queries";
import { esJson, fetchIndices, flattenMapping, mappingProperties } from "../../lib/es";
import { ToolButton } from "../../ui/ToolButton";
import { Combobox } from "../../ui/Combobox";
import { Icon } from "../../ui/Icon";
import { NoIndexState } from "../../ui/NoIndexState";
import { JsonResponseViewer } from "../../ui/JsonResponseViewer";
import { DiffModal } from "../DiffModal";
import { formatNumber } from "../../lib/format";

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>
      )}
    </>
  );
}

export function MappingView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const activeIndex = useApp((s) => s.activeIndex);
  const setActiveIndex = useApp((s) => s.setActiveIndex);
  const bumpIndexRecency = useApp((s) => s.bumpIndexRecency);
  const index = activeIndex ?? conn?.defaultIndex ?? null;
  const indices = useIndices();
  const raw = useRawMapping(index);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"tree" | "json">("tree");
  const connections = useApp((s) => s.connections);
  const showToast = useApp((s) => s.showToast);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [targetConnId, setTargetConnId] = useState("");
  const [targetIndex, setTargetIndex] = useState("");
  const [comparing, setComparing] = useState(false);
  const [diff, setDiff] = useState<{ title: string; badge: string; before: string; after: string } | null>(null);

  const pickIndex = (i: string) => {
    setActiveIndex(i);
    bumpIndexRecency(i);
  };

  const targetConn = connections.find((c) => c.id === targetConnId) ?? null;
  // options for the target index picker — same cache key the sidebar/reindex use
  const targetIndices = useQuery({
    queryKey: ["indices", targetConn?.id],
    queryFn: () => fetchIndices(targetConn!),
    enabled: pickerOpen && !!targetConn,
    staleTime: 10_000,
  });

  const openPicker = () => {
    setTargetConnId((prev) => prev || conn?.id || "");
    setTargetIndex((prev) => prev || index || "");
    setPickerOpen(true);
  };

  /** Strip the outer index-name key so a rename doesn't drown the real differences. */
  const mappingBody = (res: Record<string, unknown>) => {
    const first = Object.values(res)[0];
    return JSON.stringify(first ?? res, null, 2);
  };

  const runCompare = async () => {
    if (!conn || !index || !targetConn || !targetIndex.trim() || comparing) return;
    setComparing(true);
    try {
      const [mine, theirs] = await Promise.all([
        esJson<Record<string, unknown>>(conn, "GET", `/${encodeURIComponent(index)}/_mapping`),
        esJson<Record<string, unknown>>(targetConn, "GET", `/${encodeURIComponent(targetIndex.trim())}/_mapping`),
      ]);
      setPickerOpen(false);
      setDiff({
        title: `Mapping · ${index} vs ${targetIndex.trim()}`,
        badge: `${conn.name} → ${targetConn.name}`,
        before: mappingBody(mine),
        after: mappingBody(theirs),
      });
    } catch (err) {
      showToast("Compare failed", String(err), "err");
    } finally {
      setComparing(false);
    }
  };

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

  const rawJson = useMemo(() => (raw.data ? JSON.stringify(raw.data, null, 2) : ""), [raw.data]);

  const q = filter.trim().toLowerCase();
  const shown = q
    ? fields.filter((f) => f.path.toLowerCase().includes(q) || f.type.toLowerCase().includes(q))
    : fields;

  const pad = (s: string) => s.padEnd(Math.max(22, s.length + 2), " ");

  return (
    <section className={`content mapping-view ${active ? "active" : ""}`}>
      <div className="doc-head">
        <Combobox
          id="mapping-index"
          value={index ?? ""}
          placeholder="Select index…"
          options={(indices.data ?? []).map((i) => ({ value: i.index, hint: i.health }))}
          onChange={pickIndex}
        />
        {index && view === "tree" && (
          <span>
            {q ? `${formatNumber(shown.length)}/${formatNumber(fields.length)}` : formatNumber(fields.length)} fields
          </span>
        )}
        {index && (
          <div className="seg" style={{ marginLeft: "auto" }}>
            <ToolButton
              title="Diff this mapping against an index on any saved connection"
              onClick={openPicker}
            >
              <Icon name="github" /> Compare…
            </ToolButton>
            <ToolButton
              iconOnly
              title={view === "tree" ? "Switch to raw JSON mapping (Monaco editor)" : "Switch to field tree view"}
              aria-label={view === "tree" ? "Switch to raw JSON mapping" : "Switch to field tree view"}
              onClick={() => setView((v) => (v === "tree" ? "json" : "tree"))}
            >
              <Icon name={view === "tree" ? "code" : "table"} />
            </ToolButton>
            {view === "tree" && (
              <input
                className="side-search"
                style={{ width: 220, height: 28 }}
                placeholder="Filter fields by path or type"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            )}
          </div>
        )}
      </div>
      {raw.error && (
        <div className="err-note">
          {String(raw.error)}
          <ToolButton title="Reload the mapping" onClick={() => void raw.refetch()}>
            <Icon name="refresh" /> Retry
          </ToolButton>
        </div>
      )}
      {!index && (
        <NoIndexState
          title="No index selected"
          hint="Pick one below to inspect its field types and settings."
          onPick={pickIndex}
        />
      )}
      {index && !raw.error && view === "tree" && (
        <div className="json-view-body json-tree">
          <div className="json-tree-line">
            <span className="syntax-key">{index}</span>
          </div>
          <div className="json-tree-line">
            <span className="syntax-section">  properties</span>
          </div>
          {shown.map((f) => (
            <div className="json-tree-line" key={f.path}>
              <span className="syntax-property">    {pad(f.path)}</span>
              <span className="syntax-type">
                <Highlight text={f.type} q={q} />
              </span>
            </div>
          ))}
          {q && shown.length === 0 && (
            <div className="json-tree-line">
              <span className="syntax-comment">    (no fields match)</span>
            </div>
          )}
          <div className="json-tree-line">
            <span className="syntax-section">  settings</span>
          </div>
          {settings.map(([k, v]) => (
            <div className="json-tree-line" key={k}>
              <span className="syntax-property">    {pad(k)}</span>
              <span className={typeof v === "number" || !isNaN(Number(v)) ? "syntax-number" : "syntax-string"}>
                {v}
              </span>
            </div>
          ))}
        </div>
      )}
      {index && !raw.error && view === "json" && (
        <div className="mapping-json-host">
          <JsonResponseViewer value={rawJson} />
        </div>
      )}
      {pickerOpen && (
        <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) setPickerOpen(false); }}>
          <div className="prompt-dialog" role="dialog" aria-modal="true" aria-label="Compare mapping">
            <strong>Compare mapping</strong>
            <p className="prompt-dialog-msg">
              Diff <code>{index}</code> on {conn?.name ?? "this cluster"} against an index on any
              saved connection.
            </p>
            <select
              className="side-search"
              style={{ width: "100%", marginBottom: 8 }}
              value={targetConnId}
              onChange={(e) => setTargetConnId(e.target.value)}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.endpoint}</option>
              ))}
            </select>
            <Combobox
              id="mapping-compare-index"
              value={targetIndex}
              placeholder="Target index…"
              options={(targetIndices.data ?? []).map((i) => ({ value: i.index, hint: i.health }))}
              onChange={setTargetIndex}
            />
            <div className="prompt-dialog-foot">
              <ToolButton onClick={() => setPickerOpen(false)}>Cancel</ToolButton>
              <ToolButton
                variant="primary"
                disabled={comparing || !targetConn || !targetIndex.trim()}
                onClick={() => void runCompare()}
              >
                {comparing ? "Comparing…" : "Compare"}
              </ToolButton>
            </div>
          </div>
        </div>
      )}
      <AnimatePresence>
        {diff && (
          <DiffModal
            title={diff.title}
            badge={diff.badge}
            before={diff.before}
            after={diff.after}
            confirmLabel="Done"
            onCancel={() => setDiff(null)}
            onConfirm={() => setDiff(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
