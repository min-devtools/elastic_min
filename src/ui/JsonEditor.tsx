import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { loadVimMode, MONACO_THEME, monaco } from "../lib/monaco";
import { useApp } from "../store";

interface Props {
  value: string;
  onChange?: (v: string) => void;
  /** element the vim statusbar renders into (mode indicator) */
  vimStatusRef?: React.RefObject<HTMLElement>;
  fontSize?: number;
  lineNumbers?: boolean;
  /** read-only viewer (e.g. query results) — no editing, no vim */
  readOnly?: boolean;
  /** dotted field path to reveal + highlight (e.g. "customer.email") */
  highlightPath?: string | null;
}

/** Compact Monaco JSON editor — theme/font/vim follow app settings. */
export function JsonEditor({ value, onChange, vimStatusRef, fontSize, lineNumbers = false, readOnly = false, highlightPath }: Props) {
  const vimMode = useApp((s) => s.vimMode);
  const editorFont = useApp((s) => s.editorFont);
  const editorFontSize = useApp((s) => s.editorFontSize);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const vimRef = useRef<{ dispose(): void } | null>(null);
  const decoRef = useRef<string[]>([]);
  const [mounted, setMounted] = useState(false);

  const size = fontSize ?? editorFontSize;

  // reveal + highlight the line of the clicked field (walk dotted path segments)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !mounted) return;
    decoRef.current = editor.deltaDecorations(decoRef.current, []);
    if (!highlightPath) return;
    const model = editor.getModel();
    if (!model) return;
    let from = { lineNumber: 1, column: 1 };
    let hit: ReturnType<typeof model.findNextMatch> = null;
    for (const seg of highlightPath.split(".")) {
      hit = model.findNextMatch(`"${seg}"`, from, false, true, null, false);
      if (!hit) return;
      from = { lineNumber: hit.range.startLineNumber, column: hit.range.endColumn };
    }
    if (!hit) return;
    const line = hit.range.startLineNumber;
    editor.revealLineInCenter(line);
    decoRef.current = editor.deltaDecorations([], [
      {
        range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
        options: { isWholeLine: true, className: "field-highlight-line" },
      },
    ]);
  }, [highlightPath, value, mounted]);

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    if (vimMode && editorRef.current && !vimRef.current) {
      void loadVimMode().then((initVimMode) => {
        if (!cancelled && editorRef.current && !vimRef.current) {
          vimRef.current = initVimMode(editorRef.current, vimStatusRef?.current ?? null);
        }
      });
    }
    if (!vimMode && vimRef.current) {
      vimRef.current.dispose();
      vimRef.current = null;
      if (vimStatusRef?.current) vimStatusRef.current.textContent = "";
    }
    return () => {
      cancelled = true;
      vimRef.current?.dispose();
      vimRef.current = null;
    };
  }, [vimMode, vimStatusRef]);

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
    setMounted(true);
    if (!readOnly && useApp.getState().vimMode && !vimRef.current) {
      void loadVimMode().then((initVimMode) => {
        if (editorRef.current === editor && !vimRef.current) {
          vimRef.current = initVimMode(editor, vimStatusRef?.current ?? null);
        }
      });
    }
  };

  return (
    <Editor
      language="json"
      theme={MONACO_THEME}
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      onMount={onMount}
      options={{
        readOnly,
        domReadOnly: readOnly,
        minimap: { enabled: false },
        fontSize: size,
        lineHeight: Math.round(size * 1.65),
        fontFamily: editorFont
          ? `"${editorFont}", ui-monospace, Menlo, monospace`
          : '"Google Sans Code", "Berkeley Mono", ui-monospace, Menlo, Consolas, monospace',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        lineNumbers: lineNumbers ? "on" : "off",
        glyphMargin: false,
        folding: true,
        stickyScroll: { enabled: false },
        lineDecorationsWidth: 6,
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        padding: { top: 8 },
        wordWrap: "off",
      }}
    />
  );
}
