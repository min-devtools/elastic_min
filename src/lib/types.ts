import type { ConnColor } from "./connColor";

export type AuthType = "apiKey" | "basic" | "none";

export interface Connection {
  id: string;
  name: string;
  /** user-assigned identity color, drawn as the dot on every tab bound to this connection */
  color?: ConnColor;
  endpoint: string;
  authType: AuthType;
  apiKey?: string;
  username?: string;
  password?: string;
  insecure: boolean;
  defaultIndex?: string;
}

export interface EsRawResponse {
  status: number;
  timeMs: number;
  body: string;
}

export interface EsHit {
  _index: string;
  _id: string;
  _score: number | null;
  _source?: Record<string, unknown>;
  _version?: number;
  _seq_no?: number;
  _primary_term?: number;
}

export interface IndexInfo {
  health: "green" | "yellow" | "red";
  status: string;
  index: string;
  docsCount: number;
  storeSize: string;
  pri: string;
  rep: string;
  aliases: string[];
}

export interface MappingField {
  path: string;
  type: string;
}

export type TabKind =
  | "welcome"
  | "connection"
  | "query"
  | "quick-query"
  | "docs"
  | "indexes"
  | "create-index"
  | "cluster"
  | "mapping"
  | "settings"
  | "history"
  | "index-stats"
  | "saved-queries";

export interface TabDef {
  id: string;
  kind: TabKind;
  title: string;
  icon: IconName;
  iconClass: string;
  /**
   * Connection this tab is bound to, fixed at creation and never reassigned — a tab
   * represents one cluster for its whole life. Undefined on the global kinds, which
   * belong to the app rather than to a cluster.
   */
  connId?: string;
}

export interface QueryResult {
  status: number;
  timeMs: number;
  hits: EsHit[] | null;
  total: number | null;
  raw: unknown;
  error?: string;
}

export interface QueryTabState {
  method: string;
  path: string;
  body: string;
  result: QueryResult | null;
  running: boolean;
}

export interface DocsTabState {
  index: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  method: string;
  path: string;
  body: string;
  createdAt: number;
}

export interface HistoryEntry {
  at: number;
  method: string;
  path: string;
  body: string;
  status: number;
  timeMs: number;
  hits: number | null;
  connId?: string;
  connName?: string;
}
import type { IconName } from "../ui/Icon";
