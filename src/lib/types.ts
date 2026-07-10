export type AuthType = "apiKey" | "basic" | "none";

export interface Connection {
  id: string;
  name: string;
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
  _source: Record<string, unknown>;
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
  | "index-stats";

export interface TabDef {
  id: string;
  kind: TabKind;
  title: string;
  icon: string;
  iconClass: string;
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
}
