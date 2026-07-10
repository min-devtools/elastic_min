import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { initVimMode } from "monaco-vim";
import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { StatusDot } from "../../ui/StatusDot";
import { Icon } from "../../ui/Icon";
import { useApp } from "../../store";
import { useActiveConnection, useMappingFields } from "../../lib/queries";
import { setCompletionFields } from "../../lib/monaco";
import { startResize } from "../ResizeHandles";
import { ResultsPanel } from "./ResultsPanel";
import { runQueryTab, saveActiveQuery } from "../../lib/runQuery";
import { themeBase } from "../../lib/themes";

const METHODS = ["GET", "POST", "PUT", "DELETE", "HEAD"];

function indexFromPath(path: string): string {
  const seg = path.replace(/^\//, "").split("/")[0] ?? "";
  return seg.startsWith("_") ? "" : seg;
}

export function QueryView({ tabId, active }: { tabId: string; active: boolean }) {
  const conn = useActiveConnection();
  const theme = useApp((s) => s.theme);
  const vimMode = useApp((s) => s.vimMode);
  const editorFontSize = useApp((s) => s.editorFontSize);
  const editorFont = useApp((s) => s.editorFont);
  const qt = useApp((s) => s.queryTabs[tabId]);
  const updateQueryTab = useApp((s) => s.updateQueryTab);
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
    const editor = editorRef.current;
    if (vimMode && editor && !vimRef.current) {
      vimRef.current = initVimMode(editor, vimStatusRef.current);
    }
    if (!vimMode && vimRef.current) {
      vimRef.current.dispose();
      vimRef.current = null;
      if (vimStatusRef.current) vimStatusRef.current.textContent = "";
    }
    return () => {
      vimRef.current?.dispose();
      vimRef.current = null;
    };
  }, [vimMode]);

  if (!qt) return null;

  let jsonValid = true;
  try {
    if (qt.body.trim()) JSON.parse(qt.body);
  } catch {
    jsonValid = false;
  }

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
      vimRef.current = initVimMode(editor, vimStatusRef.current);
    }
  };

  const index = indexFromPath(qt.path);

  return (
    <section className={`content query-view ${active ? "active" : ""}`}>
      <div className="editor-pane">
        <div className="editor-head">
          <div className="seg">
            <StatusDot tone={conn ? "green" : "idle"} />
            <strong>{index || "cluster"}</strong>
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
            <Badge>{jsonValid ? "JSON valid" : "JSON invalid"}</Badge>
            <ToolButton title="Save query (⌘S)" onClick={saveActiveQuery}>
              <Icon name="save" />
            </ToolButton>
            <ToolButton
              title="Format JSON body"
              onClick={() => {
                void editorRef.current?.getAction("editor.action.formatDocument")?.run();
              }}
            >
              <Icon name="code" /> Format
            </ToolButton>
            <span className="progress"><span /></span>
          </div>
        </div>
        <div className="editor-host">
          <Editor
            language="json"
            theme={themeBase(theme) === "dark" ? "elasticmin-dark" : "elasticmin-light"}
            value={qt.body}
            onChange={(v) => updateQueryTab(tabId, { body: v ?? "" })}
            onMount={onMount}
            options={{
              minimap: { enabled: false },
              fontSize: editorFontSize,
              lineHeight: Math.round(editorFontSize * 1.6),
              fontFamily: editorFont
                ? `"${editorFont}", ui-monospace, Menlo, monospace`
                : '"Berkeley Mono", ui-monospace, Menlo, Consolas, monospace',
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
