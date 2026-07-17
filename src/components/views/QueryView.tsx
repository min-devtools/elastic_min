import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { ToolButton } from "../../ui/ToolButton";
import { LoadingBar } from "../../ui/LoadingBar";
import { StatusDot } from "../../ui/StatusDot";
import { Icon } from "../../ui/Icon";
import { useApp } from "../../store";
import { useActiveConnection, useMappingFields } from "../../lib/queries";
import { loadVimMode, MONACO_THEME, setCompletionFields } from "../../lib/monaco";
import { startResize } from "../ResizeHandles";
import { ResultsPanel } from "./ResultsPanel";
import { copyActiveQueryAsCurl, runQueryTab, saveActiveQuery } from "../../lib/runQuery";

const METHODS = ["GET", "POST", "PUT", "DELETE", "HEAD"];

function indexFromPath(path: string): string {
  const seg = path.replace(/^\//, "").split("/")[0] ?? "";
  return seg.startsWith("_") ? "" : seg;
}

export function QueryView({ tabId, active }: { tabId: string; active: boolean }) {
  const conn = useActiveConnection();
  const vimMode = useApp((s) => s.vimMode);
  const editorFontSize = useApp((s) => s.editorFontSize);
  const editorFont = useApp((s) => s.editorFont);
  const qt = useApp((s) => s.queryTabs[tabId]);
  const updateQueryTab = useApp((s) => s.updateQueryTab);
  const showToast = useApp((s) => s.showToast);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const activeIndex = useApp((s) => s.activeIndex);
  const mappingIndex = indexFromPath(qt?.path ?? "") || activeIndex;
  const mapping = useMappingFields(active ? mappingIndex : null);

  // feed the autocomplete provider with this tab's mapping fields while it's focused
  useEffect(() => {
    if (active) setCompletionFields((mapping.data ?? []).map((f) => f.path));
  }, [active, mapping.data]);
  const vimRef = useRef<{ dispose(): void } | null>(null);
  const vimStatusRef = useRef<HTMLSpanElement>(null);

  // attach/detach vim mode when the setting flips (and clean up on unmount)
  useEffect(() => {
    let cancelled = false;
    if (vimMode && editorRef.current && !vimRef.current) {
      void loadVimMode().then((initVimMode) => {
        if (!cancelled && editorRef.current && !vimRef.current) {
          vimRef.current = initVimMode(editorRef.current, vimStatusRef.current);
        }
      });
    }
    if (!vimMode && vimRef.current) {
      vimRef.current.dispose();
      vimRef.current = null;
      if (vimStatusRef.current) vimStatusRef.current.textContent = "";
    }
    return () => {
      cancelled = true;
      vimRef.current?.dispose();
      vimRef.current = null;
    };
  }, [vimMode]);

  // parsed per body change, not per render — large bulk bodies make this expensive
  const jsonValid = useMemo(() => {
    try {
      if (qt?.body.trim()) JSON.parse(qt.body);
      return true;
    } catch {
      return false;
    }
  }, [qt?.body]);

  if (!qt) return null;

  // same JSON tools as requests_min's JsonEditor — shared .json-editor-tools chrome
  const transform = (pretty: boolean) => {
    try {
      updateQueryTab(tabId, { body: JSON.stringify(JSON.parse(qt.body), null, pretty ? 2 : undefined) });
    } catch (error) {
      showToast("Invalid JSON", String(error), "err");
    }
  };
  const validate = () => {
    try {
      JSON.parse(qt.body);
      showToast("JSON valid", "Ready to run.");
    } catch (error) {
      showToast("Invalid JSON", String(error), "err");
    }
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      setCursor({ line: e.position.lineNumber, col: e.position.column });
    });
    // Monaco swallows ⌘↵ (insert-line-below) before the global handler — rebind it to Run
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      void runQueryTab(tabId);
    });
    if (useApp.getState().vimMode && !vimRef.current) {
      void loadVimMode().then((initVimMode) => {
        if (editorRef.current === editor && !vimRef.current) {
          vimRef.current = initVimMode(editor, vimStatusRef.current);
        }
      });
    }
  };

  return (
    <section className={`content query-view ${active ? "active" : ""}`}>
      <div className="editor-pane">
        <div className="editor-head">
          <div className="seg">
            <StatusDot tone={conn ? "green" : "red"} />
            <select
              className="method-select"
              value={qt.method}
              onChange={(e) => updateQueryTab(tabId, { method: e.target.value })}
            >
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <input
              className="query-path-input"
              value={qt.path}
              spellCheck={false}
              onChange={(e) => updateQueryTab(tabId, { path: e.target.value })}
            />
          </div>
          <div className="seg">
            <ToolButton
              variant="primary"
              title="Run request (⌘↵)"
              aria-label="Run request"
              disabled={qt.running}
              onClick={() => void runQueryTab(tabId)}
            >
              <Icon name="play" /> {qt.running ? "Running…" : "Run"}
            </ToolButton>
            <ToolButton iconOnly title="Save query (⌘S)" aria-label="Save query" onClick={saveActiveQuery}>
              <Icon name="save" />
            </ToolButton>
            <ToolButton
              iconOnly
              title="Copy as curl"
              aria-label="Copy as curl"
              onClick={() => void copyActiveQueryAsCurl()}
            >
              <Icon name="copy" />
            </ToolButton>
          </div>
          {/* pinned to the bottom edge of the head row; overlay, never a layout child (see .editor-head) */}
          <LoadingBar active={qt.running} />
        </div>
        <div className="editor-host json-editor-shell has-json-tools">
          <div className="json-editor-tools">
            <span className={jsonValid ? "valid" : "invalid"}>JSON {jsonValid ? "valid" : "invalid"}</span>
            <span />
            <button type="button" onClick={() => transform(true)} title="Format" aria-label="Format"><Icon name="wand" size={14} /></button>
            <button type="button" onClick={() => transform(false)} title="Minify" aria-label="Minify"><Icon name="minify" size={14} /></button>
            <button type="button" onClick={validate} title="Validate" aria-label="Validate"><Icon name="check" size={14} /></button>
          </div>
          <Editor
            language="json"
            theme={MONACO_THEME}
            value={qt.body}
            onChange={(v) => updateQueryTab(tabId, { body: v ?? "" })}
            onMount={onMount}
            options={{
              minimap: { enabled: false },
              fontSize: editorFontSize,
              lineHeight: Math.round(editorFontSize * 1.6),
              fontFamily: editorFont
                ? `"${editorFont}", ui-monospace, Menlo, monospace`
                : '"Google Sans Code", "Berkeley Mono", ui-monospace, Menlo, Consolas, monospace',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              renderLineHighlight: "gutter",
              padding: { top: 10 },
            }}
          />
        </div>
        <div className="editor-foot">
          <span className="seg">
            <span ref={vimStatusRef} className="vim-status" />
            <span>request body · JSON · ⌘↵ to run</span>
          </span>
          <span>
            Ln {cursor.line}, Col {cursor.col} · UTF-8
          </span>
        </div>
      </div>
      <div
        className="query-resizer"
        title="Resize query and results panes"
        onPointerDown={(e) => startResize(e, "query")}
      />
      <ResultsPanel tabId={tabId} />
    </section>
  );
}
