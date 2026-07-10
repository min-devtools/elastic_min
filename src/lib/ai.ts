import { invoke } from "@tauri-apps/api/core";
import type { IndexInfo, MappingField } from "./types";
import { useApp } from "../store";

export interface ChatMsg {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GeneratedQuery {
  method: string;
  path: string;
  body: unknown;
  note?: string;
}

export function buildSystemPrompt(
  indices: IndexInfo[],
  activeIndex: string | null,
  fields: MappingField[],
): string {
  const indexList = indices.slice(0, 30).map((i) => i.index).join(", ") || "(unknown)";
  const mapping =
    activeIndex && fields.length
      ? `\nActive index "${activeIndex}" fields:\n${fields.slice(0, 80).map((f) => `- ${f.path}: ${f.type}`).join("\n")}`
      : "";
  return `You are an Elasticsearch query assistant inside a desktop ES client.
Cluster indexes: ${indexList}${mapping}

The user describes what they want in natural language (possibly Vietnamese). Reply with ONLY a JSON object, no markdown fences, no prose outside JSON:
{"method":"POST","path":"/<index>/_search","body":{...},"note":"<one short sentence explaining the query, same language as the user>"}

Rules:
- Prefer the index the user names; otherwise use the active index.
- Use "term" on keyword fields, "match" on text fields, "range" for dates/numbers. If unsure whether a field is keyword, use the ".keyword" subfield in term/sort when the mapping shows type "text + keyword".
- Include "size" (default 50) and "sort" when the user asks for ordering.
- For non-search requests (mapping, count, aggregations) still return a valid method/path/body.`;
}

/** Ask the configured OpenAI-compatible provider. Returns raw assistant text. */
export async function askAi(messages: ChatMsg[]): Promise<string> {
  const { aiProvider } = useApp.getState();
  return invoke<string>("ai_chat", {
    endpoint: aiProvider.endpoint,
    apiKey: aiProvider.apiKey,
    model: aiProvider.model,
    messages,
  });
}

/** Extract a generated query object from assistant text (tolerates ``` fences / prose). */
export function parseGeneratedQuery(text: string): GeneratedQuery | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    if (obj && typeof obj === "object" && (obj.body !== undefined || obj.path)) {
      return {
        method: typeof obj.method === "string" ? obj.method.toUpperCase() : "POST",
        path: typeof obj.path === "string" ? obj.path : "/_search",
        body: obj.body ?? {},
        note: typeof obj.note === "string" ? obj.note : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Put the generated query into the open Query tab (or a new one) and focus it. */
export function applyGeneratedQuery(gen: GeneratedQuery): void {
  const s = useApp.getState();
  const patch = {
    method: gen.method,
    path: gen.path,
    body: JSON.stringify(gen.body, null, 2),
  };
  const active = s.tabs.find((t) => t.id === s.activeTabId);
  const target =
    active?.kind === "query"
      ? active.id
      : [...s.tabs].reverse().find((t) => t.kind === "query")?.id;
  if (target) {
    s.updateQueryTab(target, patch);
    s.activateTab(target);
  } else {
    s.newQueryTab(patch);
  }
}
