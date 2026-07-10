import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { Connection } from "./types";
import { esJson, fetchIndices, fetchMappingFields } from "./es";
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
  });
}
