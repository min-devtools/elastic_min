import type { Connection, EsHit } from "./types";
import { esJson } from "./es";

export interface ScrollProgress {
  fetched: number;
  total: number | null;
}

const PAGE_SIZE = 1000;
/** memory guard — 100k × ~1KB docs ≈ 100MB of JSON text */
export const SCROLL_MAX_DOCS = 100_000;

/**
 * Fetch every hit of a /_search request via the scroll API (works on ES 6/7/8).
 * The tab's own from/size/scroll params are stripped; sort in the body is kept.
 */
export async function scrollAllHits(
  conn: Connection,
  path: string,
  body: string,
  onProgress: (p: ScrollProgress) => void,
  maxDocs = SCROLL_MAX_DOCS,
): Promise<{ hits: EsHit[]; total: number | null; truncated: boolean }> {
  const [rawPath, rawQuery = ""] = path.split("?");
  if (!/\/_search\/?$/.test(rawPath)) {
    throw new Error("Export all needs a /_search request (aggregations and _cat have no scrollable hits).");
  }
  const params = new URLSearchParams(rawQuery);
  params.delete("scroll");
  params.delete("from");
  params.delete("size");
  params.set("scroll", "1m");

  let parsed: any = {};
  if (body.trim()) {
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error("The query body is not valid JSON.");
    }
  }
  delete parsed.from; // scroll forbids from
  parsed.size = PAGE_SIZE;

  const all: EsHit[] = [];
  let scrollId: string | null = null;
  let total: number | null = null;
  let truncated = false;
  try {
    let page = await esJson<any>(
      conn,
      "POST",
      `${rawPath.replace(/\/$/, "")}?${params.toString()}`,
      JSON.stringify(parsed),
    );
    total =
      typeof page.hits?.total === "number"
        ? page.hits.total
        : (page.hits?.total?.value as number | undefined) ?? null;
    for (;;) {
      scrollId = page._scroll_id ?? scrollId;
      const hits: EsHit[] = page.hits?.hits ?? [];
      if (!hits.length) break;
      all.push(...hits);
      onProgress({ fetched: all.length, total });
      if (all.length >= maxDocs) {
        truncated = (total ?? Infinity) > all.length;
        break;
      }
      if (!scrollId) break;
      page = await esJson<any>(
        conn,
        "POST",
        "/_search/scroll",
        JSON.stringify({ scroll: "1m", scroll_id: scrollId }),
      );
    }
  } finally {
    // free server-side scroll context; ignore failures (it expires on its own)
    if (scrollId) {
      void esJson(conn, "DELETE", "/_search/scroll", JSON.stringify({ scroll_id: scrollId })).catch(
        () => undefined,
      );
    }
  }
  return { hits: all.slice(0, maxDocs), total, truncated };
}
