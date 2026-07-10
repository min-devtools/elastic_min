import { invoke } from "@tauri-apps/api/core";
import type { Connection, EsRawResponse, IndexInfo, MappingField } from "./types";

export interface EsResult {
  status: number;
  timeMs: number;
  json: unknown;
  raw: string;
}

export async function esRequest(
  conn: Connection,
  method: string,
  path: string,
  body?: string,
): Promise<EsResult> {
  // _bulk requires NDJSON content type
  const contentType = /\/_bulk(\?|$)/.test(path) ? "application/x-ndjson" : "application/json";
  const res = await invoke<EsRawResponse>("es_request", {
    conn: {
      endpoint: conn.endpoint,
      authType: conn.authType,
      apiKey: conn.apiKey,
      username: conn.username,
      password: conn.password,
      insecure: conn.insecure,
    },
    method,
    path,
    body: body ?? null,
    contentType,
  });
  let json: unknown = null;
  try {
    json = JSON.parse(res.body);
  } catch {
    json = null;
  }
  return { status: res.status, timeMs: res.timeMs, json, raw: res.body };
}

/** Throws with the ES error reason when status >= 400. */
export async function esJson<T = unknown>(
  conn: Connection,
  method: string,
  path: string,
  body?: string,
): Promise<T> {
  const res = await esRequest(conn, method, path, body);
  if (res.status >= 400) {
    const j = res.json as { error?: { reason?: string; type?: string } } | null;
    const reason =
      j?.error?.reason || j?.error?.type || `HTTP ${res.status}: ${res.raw.slice(0, 300)}`;
    throw new Error(reason);
  }
  return res.json as T;
}

interface CatIndexRow {
  health: "green" | "yellow" | "red";
  status: string;
  index: string;
  "docs.count": string | null;
  "store.size": string | null;
  pri: string;
  rep: string;
}

export async function fetchIndices(conn: Connection): Promise<IndexInfo[]> {
  const [rows, aliasRows] = await Promise.all([
    esJson<CatIndexRow[]>(conn, "GET", "/_cat/indices?format=json&h=health,status,index,docs.count,store.size,pri,rep"),
    esJson<{ alias: string; index: string }[]>(conn, "GET", "/_cat/aliases?format=json&h=alias,index").catch(() => []),
  ]);
  const aliasesByIndex = new Map<string, string[]>();
  for (const a of aliasRows) {
    const list = aliasesByIndex.get(a.index) ?? [];
    list.push(a.alias);
    aliasesByIndex.set(a.index, list);
  }
  return rows
    .map((r) => ({
      health: r.health,
      status: r.status,
      index: r.index,
      docsCount: Number(r["docs.count"] ?? 0),
      storeSize: r["store.size"] ?? "—",
      pri: r.pri,
      rep: r.rep,
      aliases: aliasesByIndex.get(r.index) ?? [],
    }))
    .sort((a, b) => b.docsCount - a.docsCount);
}

/** Flatten an ES mapping properties object into dotted field paths. */
export function flattenMapping(
  properties: Record<string, any> | undefined,
  prefix = "",
): MappingField[] {
  if (!properties) return [];
  const out: MappingField[] = [];
  for (const [name, def] of Object.entries(properties)) {
    const path = prefix ? `${prefix}.${name}` : name;
    if (def.type) {
      const subTypes = def.fields ? ` + ${Object.values(def.fields).map((f: any) => f.type).join(", ")}` : "";
      out.push({ path, type: `${def.type}${subTypes}` });
    }
    if (def.properties) {
      if (!def.type) out.push({ path, type: "object" });
      out.push(...flattenMapping(def.properties, path));
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** Get the properties object out of a _mapping response, handling ES 6 typed mappings. */
export function mappingProperties(mappings: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!mappings) return undefined;
  if (mappings.properties) return mappings.properties;
  // ES 6.x: mappings.<doc_type>.properties
  const typed = Object.values(mappings).find(
    (v: any) => v && typeof v === "object" && v.properties,
  ) as { properties?: Record<string, any> } | undefined;
  return typed?.properties;
}

export async function fetchMappingFields(
  conn: Connection,
  index: string,
): Promise<MappingField[]> {
  const res = await esJson<Record<string, { mappings: Record<string, any> }>>(
    conn,
    "GET",
    `/${encodeURIComponent(index)}/_mapping`,
  );
  const first = Object.values(res)[0];
  return flattenMapping(mappingProperties(first?.mappings));
}
