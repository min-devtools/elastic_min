import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { Connection } from "./types";
import { esJson, fetchIndices, fetchMappingFields } from "./es";
import { summarizeNodesStats, type CatNodeRow, type NodeMetricSample } from "./nodes";
import { recordSample, sampleHistory } from "./metricsHistory";
import { activeConnection, useApp } from "../store";

/** One cluster sync every 10s is plenty — applies to all background polling. */
const SYNC_INTERVAL = 10_000;

export function useActiveConnection(): Connection | null {
  return useApp((s) => activeConnection(s));
}

export function useIndices() {
  const conn = useActiveConnection();
  return useQuery({
    queryKey: ["indices", conn?.id],
    queryFn: () => fetchIndices(conn!),
    enabled: !!conn,
    refetchInterval: SYNC_INTERVAL,
    staleTime: SYNC_INTERVAL,
  });
}

export function useMappingFields(index: string | null) {
  const conn = useActiveConnection();
  return useQuery({
    queryKey: ["mapping", conn?.id, index],
    queryFn: () => fetchMappingFields(conn!, index!),
    enabled: !!conn && !!index,
    staleTime: 30_000,
  });
}

export interface ClusterHealth {
  cluster_name: string;
  status: "green" | "yellow" | "red";
  number_of_nodes: number;
  number_of_data_nodes: number;
  active_shards: number;
  active_primary_shards: number;
  relocating_shards: number;
  initializing_shards: number;
  unassigned_shards: number;
  active_shards_percent_as_number: number;
}

export function useClusterHealth() {
  const conn = useActiveConnection();
  return useQuery({
    queryKey: ["cluster-health", conn?.id],
    queryFn: () => esJson<ClusterHealth>(conn!, "GET", "/_cluster/health"),
    enabled: !!conn,
    refetchInterval: SYNC_INTERVAL,
    staleTime: SYNC_INTERVAL,
  });
}

export function useClusterInfo() {
  const conn = useActiveConnection();
  return useQuery({
    queryKey: ["cluster-info", conn?.id],
    queryFn: () =>
      esJson<{ cluster_name: string; version: { number: string } }>(conn!, "GET", "/"),
    enabled: !!conn,
    staleTime: Infinity,
  });
}

export function useClusterStats() {
  const conn = useActiveConnection();
  return useQuery({
    queryKey: ["cluster-stats", conn?.id],
    queryFn: () => esJson<any>(conn!, "GET", "/_cluster/stats"),
    enabled: !!conn,
    refetchInterval: SYNC_INTERVAL,
    staleTime: SYNC_INTERVAL,
  });
}

export function useCatNodes() {
  const conn = useActiveConnection();
  return useQuery({
    queryKey: ["cat-nodes", conn?.id],
    queryFn: () =>
      esJson<CatNodeRow[]>(
        conn!,
        "GET",
        "/_cat/nodes?format=json&full_id=true&h=id,name,ip,node.role,master,version,cpu,heap.percent,ram.percent,disk.total,disk.used_percent,load_1m,uptime",
      ),
    enabled: !!conn,
    refetchInterval: SYNC_INTERVAL,
    staleTime: SYNC_INTERVAL,
  });
}

/**
 * Rolling per-connection metric history for the sparklines. Each poll collapses
 * /_nodes/stats into one sample and appends it to the in-memory buffer; the
 * buffer survives tab switches, so the chart doesn't restart on every visit.
 */
export function useNodeMetricSamples(): NodeMetricSample[] {
  const conn = useActiveConnection();
  const stats = useQuery({
    queryKey: ["node-metrics", conn?.id],
    queryFn: async () => {
      const json = await esJson<unknown>(
        conn!,
        "GET",
        "/_nodes/stats/jvm,os,indices?filter_path=nodes.*.jvm.mem,nodes.*.os.cpu,nodes.*.indices.indexing.index_total,nodes.*.indices.search.query_total",
      );
      return summarizeNodesStats(json, Date.now());
    },
    enabled: !!conn,
    refetchInterval: SYNC_INTERVAL,
    staleTime: SYNC_INTERVAL,
  });
  // recordSample dedupes by timestamp, so the render-time call is idempotent
  return useMemo(() => {
    if (!conn) return [];
    return stats.data ? recordSample(conn.id, stats.data) : sampleHistory(conn.id);
  }, [conn, stats.data]);
}

export interface CatShardRow {
  index: string;
  shard: string;
  prirep: string;
  state: string;
  docs: string | null;
  store: string | null;
  node: string | null;
  "unassigned.reason": string | null;
}

export function useCatShards() {
  const conn = useActiveConnection();
  return useQuery({
    queryKey: ["cat-shards", conn?.id],
    queryFn: () =>
      esJson<CatShardRow[]>(
        conn!,
        "GET",
        "/_cat/shards?format=json&h=index,shard,prirep,state,docs,store,node,unassigned.reason",
      ),
    enabled: !!conn,
    refetchInterval: SYNC_INTERVAL,
    staleTime: SYNC_INTERVAL,
  });
}

export interface OverviewEntry {
  connId: string;
  clusterName: string | null;
  status: "green" | "yellow" | "red" | null;
  nodes: number | null;
  indices: number | null;
  docs: number | null;
  storeBytes: number | null;
  versions: string[];
  timeMs: number;
  error: string | null;
}

/** One /_cluster/stats probe per saved connection — the all-clusters dashboard. */
export function useClusterOverview() {
  const connections = useApp((s) => s.connections);
  const ids = connections.map((c) => c.id).join(",");
  return useQuery({
    queryKey: ["overview", ids],
    enabled: connections.length > 0,
    refetchInterval: SYNC_INTERVAL,
    staleTime: SYNC_INTERVAL,
    queryFn: (): Promise<OverviewEntry[]> =>
      Promise.all(
        connections.map(async (c): Promise<OverviewEntry> => {
          const started = Date.now();
          try {
            const s = await esJson<any>(c, "GET", "/_cluster/stats");
            return {
              connId: c.id,
              clusterName: s.cluster_name ?? null,
              status: s.status ?? null,
              nodes: s.nodes?.count?.total ?? null,
              indices: s.indices?.count ?? null,
              docs: s.indices?.docs?.count ?? null,
              storeBytes: s.indices?.store?.size_in_bytes ?? null,
              versions: s.nodes?.versions ?? [],
              timeMs: Date.now() - started,
              error: null,
            };
          } catch (err) {
            return {
              connId: c.id,
              clusterName: null,
              status: null,
              nodes: null,
              indices: null,
              docs: null,
              storeBytes: null,
              versions: [],
              timeMs: Date.now() - started,
              error: String(err),
            };
          }
        }),
      ),
  });
}

export function useSystemFonts() {
  return useQuery({
    queryKey: ["system-fonts"],
    queryFn: () => invoke<string[]>("list_fonts"),
    staleTime: Infinity,
  });
}

export function useRawMapping(index: string | null) {
  const conn = useActiveConnection();
  return useQuery({
    queryKey: ["raw-mapping", conn?.id, index],
    queryFn: async () => {
      const [mapping, settings] = await Promise.all([
        esJson<any>(conn!, "GET", `/${encodeURIComponent(index!)}/_mapping`),
        esJson<any>(conn!, "GET", `/${encodeURIComponent(index!)}/_settings`),
      ]);
      return { mapping, settings };
    },
    enabled: !!conn && !!index,
    staleTime: 30_000,
  });
}
