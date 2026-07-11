// Bundle Monaco locally (no CDN) and register only the JSON worker we need.
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import { loader } from "@monaco-editor/react";

export const MONACO_THEME = "elasticmin-live";

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") return new jsonWorker();
    return new editorWorker();
  },
};

// bare (no "#") hex for Monaco token colors; "#rrggbb" for editor.colors
const bare = (v: string | undefined, fallback: string) =>
  (v?.trim().startsWith("#") ? v.trim() : `#${fallback}`).slice(1);
const withHash = (v: string | undefined, fallback: string) =>
  v?.trim().startsWith("#") ? v.trim() : `#${fallback}`;

function defineThemes(base: "dark" | "light", p: Record<string, string>) {
  monaco.editor.defineTheme(MONACO_THEME, {
    base: base === "dark" ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "string.key.json", foreground: bare(p.syntaxKey, "5aa7ff") },
      { token: "string.value.json", foreground: bare(p.syntaxString, "58d68d") },
      { token: "number", foreground: bare(p.syntaxNumber, "79c0ff") },
      { token: "keyword.json", foreground: bare(p.syntaxBoolean, "b794f4") },
      { token: "delimiter", foreground: bare(p.textMuted, "717680") },
    ],
    colors: {
      "editor.background": withHash(p.surfaceEditor, base === "dark" ? "0d0f14" : "fbfbfc"),
      "editor.foreground": withHash(p.textPrimary, base === "dark" ? "d7dce5" : "1c2430"),
      "editorLineNumber.foreground": withHash(p.textMuted, "4a4f58"),
      "editorCursor.foreground": withHash(p.accentFocus, "5aa7ff"),
      "editor.selectionBackground": withHash(p.accentPrimary, "5aa7ff") + "44",
      "editor.inactiveSelectionBackground": withHash(p.accentPrimary, "5aa7ff") + "22",
      "editorWidget.background": withHash(p.surfaceRaised, "191b21"),
      "editorWidget.border": withHash(p.borderDefault, "333842"),
      "editorSuggestWidget.selectedBackground": withHash(p.accentPrimary, "5aa7ff") + "33",
      "editorError.foreground": withHash(p.statusDanger, "ff6b75"),
      "editorWarning.foreground": withHash(p.statusWarning, "f7b267"),
    },
  });
}

defineThemes("dark", {});

/** Re-tint Monaco to the active app theme's actual palette (not just dark/light). */
export function retintMonaco(base: "dark" | "light", palette: Record<string, string>) {
  defineThemes(base, palette);
  monaco.editor.setTheme(MONACO_THEME);
}

// --- field-path autocomplete (fed by the active query tab's index mapping) ---
let completionFields: string[] = [];
export function setCompletionFields(fields: string[]) {
  completionFields = fields;
}

const DSL_KEYWORDS = [
  "query", "bool", "must", "must_not", "should", "filter", "term", "terms", "match",
  "match_all", "match_phrase", "range", "exists", "wildcard", "prefix", "regexp", "ids",
  "nested", "gte", "lte", "gt", "lt", "sort", "size", "from", "_source", "aggs",
  "track_total_hits", "minimum_should_match", "query_string", "multi_match", "order",
];

monaco.languages.registerCompletionItemProvider("json", {
  triggerCharacters: ['"'],
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position);
    const range = new monaco.Range(
      position.lineNumber, word.startColumn, position.lineNumber, word.endColumn,
    );
    return {
      suggestions: [
        ...completionFields.map((f) => ({
          label: f,
          kind: monaco.languages.CompletionItemKind.Field,
          insertText: f,
          detail: "mapping field",
          range,
        })),
        ...DSL_KEYWORDS.map((k) => ({
          label: k,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: k,
          detail: "query DSL",
          range,
        })),
      ],
    };
  },
});

loader.config({ monaco });

export { monaco };
