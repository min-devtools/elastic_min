import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Kv } from "../ui/Kv";
import { MiniTabs } from "../ui/MiniTabs";
import { ToolButton } from "../ui/ToolButton";
import { Icon } from "../ui/Icon";
import { Badge } from "../ui/Badge";
import { JsonEditor } from "../ui/JsonEditor";
import { AiChat } from "./AiChat";
import { DiffModal } from "./DiffModal";
import { useApp } from "../store";
import { useActiveConnection } from "../lib/queries";
import { esJson } from "../lib/es";

export function Inspector() {
  const [pane, setPane] = useState("json");
  const [draft, setDraft] = useState("");
  const [original, setOriginal] = useState("");
  const [diffOpen, setDiffOpen] = useState(false);
  const conn = useActiveConnection();
  const queryClient = useQueryClient();
  const selectedDoc = useApp((s) => s.selectedDoc);
  const selectDoc = useApp((s) => s.selectDoc);
  const focusField = useApp((s) => s.focusField);
  const showToast = useApp((s) => s.showToast);
  const setInspectorDirty = useApp((s) => s.setInspectorDirty);
  const vimStatusRef = useRef<HTMLSpanElement>(null);

  // reload editor when another document is selected
  useEffect(() => {
    const json = selectedDoc ? JSON.stringify(selectedDoc._source ?? {}, null, 2) : "";
    setDraft(json);
    setOriginal(json);
  }, [selectedDoc]);

  const dirty = draft !== original;
  // row clicks check this before discarding the draft
  useEffect(() => {
    setInspectorDirty(dirty);
  }, [dirty, setInspectorDirty]);

  const draftValid = useMemo(() => {
    try {
      if (draft.trim()) JSON.parse(draft);
      return true;
    } catch {
      return false;
    }
  }, [draft]);

  const save = async () => {
    if (!conn || !selectedDoc) return;
    try {
      const parsed = JSON.parse(draft);
      const concurrency =
        selectedDoc._seq_no != null && selectedDoc._primary_term != null
          ? `?if_seq_no=${selectedDoc._seq_no}&if_primary_term=${selectedDoc._primary_term}&refresh=true`
          : "?refresh=true";
      const res = await esJson<{ _version?: number; _seq_no?: number; _primary_term?: number }>(
        conn,
        "PUT",
        `/${encodeURIComponent(selectedDoc._index)}/_doc/${encodeURIComponent(selectedDoc._id)}${concurrency}`,
        JSON.stringify(parsed),
      );
      setDiffOpen(false);
      setOriginal(draft);
      // carry new seq_no/version so consecutive saves don't 409
      selectDoc({
        ...selectedDoc,
        _source: parsed,
        _version: res._version ?? selectedDoc._version,
        _seq_no: res._seq_no ?? selectedDoc._seq_no,
        _primary_term: res._primary_term ?? selectedDoc._primary_term,
      });
      void queryClient.invalidateQueries({ queryKey: ["docs"] });
      showToast("Document saved", `${selectedDoc._id} updated in ${selectedDoc._index}.`);
    } catch (err) {
      setDiffOpen(false);
      showToast("Save failed", String(err), "err");
    }
  };

  return (
    <aside className="inspector">
      <div className="inspector-head">
        <div className="doc-title">
          <strong>{selectedDoc?._id ?? "no document"}</strong>
          <span>
            {selectedDoc
              ? `${selectedDoc._index} · _doc${selectedDoc._version != null ? ` · v${selectedDoc._version}` : ""}`
              : "select a row to inspect"}
          </span>
        </div>
        {dirty && <Badge style={{ color: "var(--orange)" }}>unsaved</Badge>}
      </div>
      <MiniTabs
        tabs={[
          { id: "json", label: "JSON" },
          { id: "meta", label: "Metadata" },
          { id: "ai", label: "AI" },
        ]}
        active={pane}
        onChange={setPane}
      />
      {pane === "json" && (
        <div className="inspector-edit">
          {selectedDoc ? (
            <div className="inspector-editor-host">
              <JsonEditor value={draft} onChange={setDraft} vimStatusRef={vimStatusRef} highlightPath={focusField} />
            </div>
          ) : (
            <div className="empty-note">Run a query and click a row — the document is editable right here.</div>
          )}
          <div className="inspector-edit-foot">
            <span className="seg">
              <span ref={vimStatusRef} className="vim-status" />
              <span className={dirty ? "dirty" : "saved"}>
                {!selectedDoc ? "" : dirty ? (draftValid ? "Modified" : "Invalid JSON") : "Saved"}
              </span>
            </span>
            <span className="seg">
              <ToolButton title="Discard changes" disabled={!dirty} onClick={() => setDraft(original)}>
                <Icon name="refresh" /> Reset
              </ToolButton>
              <ToolButton
                variant="primary"
                title="Review diff and save to Elasticsearch"
                disabled={!dirty || !draftValid || !selectedDoc}
                onClick={() => setDiffOpen(true)}
              >
                <Icon name="save" /> Save
              </ToolButton>
            </span>
          </div>
        </div>
      )}
      {pane === "meta" && (
        <div className="inspector-scroll">
          {!selectedDoc && <div className="empty-note">No document selected.</div>}
          {selectedDoc && (
            <div className="panel">
              <h3>Metadata</h3>
              <Kv label="_index">{selectedDoc._index}</Kv>
              <Kv label="_id">{selectedDoc._id}</Kv>
              <Kv label="_score">{selectedDoc._score ?? "—"}</Kv>
              {selectedDoc._version != null && <Kv label="_version">{selectedDoc._version}</Kv>}
              {selectedDoc._seq_no != null && <Kv label="_seq_no">{selectedDoc._seq_no}</Kv>}
              {selectedDoc._primary_term != null && (
                <Kv label="_primary_term">{selectedDoc._primary_term}</Kv>
              )}
            </div>
          )}
        </div>
      )}
      {pane === "ai" && <AiChat />}
      {diffOpen && selectedDoc && (
        <DiffModal
          title="Review changes before save"
          badge={`${selectedDoc._index} / ${selectedDoc._id}`}
          before={original}
          after={draft}
          onCancel={() => setDiffOpen(false)}
          onConfirm={() => void save()}
        />
      )}
    </aside>
  );
}
