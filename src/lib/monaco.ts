// Bundle Monaco locally (no CDN) and register only the JSON worker we need.
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import { loader } from "@monaco-editor/react";

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") return new jsonWorker();
    return new editorWorker();
  },
};

function defineThemes(darkBg = "#0d0f14", lightBg = "#fbfbfc") {
  monaco.editor.defineTheme("elasticmin-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "string.key.json", foreground: "5aa7ff" },
      { token: "string.value.json", foreground: "58d68d" },
      { token: "number", foreground: "79c0ff" },
      { token: "keyword.json", foreground: "b794f4" },
    ],
    colors: {
      "editor.background": darkBg,
      "editorLineNumber.foreground": "#4a4f58",
      "editorGutter.background": darkBg,
    },
  });
  monaco.editor.defineTheme("elasticmin-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "string.key.json", foreground: "1f6feb" },
      { token: "string.value.json", foreground: "1a7f4b" },
      { token: "number", foreground: "0550ae" },
    ],
    colors: {
      "editor.background": lightBg,
    },
  });
}

defineThemes();

/** Re-tint Monaco to the active app theme's editor background. */
export function retintMonaco(base: "dark" | "light", editorBg: string) {
  if (base === "dark") defineThemes(editorBg || "#0d0f14", "#fbfbfc");
  else defineThemes("#0d0f14", editorBg || "#fbfbfc");
  monaco.editor.setTheme(base === "dark" ? "elasticmin-dark" : "elasticmin-light");
}

loader.config({ monaco });

export { monaco };
