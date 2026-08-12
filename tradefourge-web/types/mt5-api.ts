// types/mt5-api.ts
// Comprehensive API Contract Types between MT5 Local Connector, TradeForge Backend, and Frontend.

export type ConnectorStatus = "active" | "revoked" | "expired";
export type SyncBatchType = "closed_trades" | "account_update" | "full_history";
export type SyncBatchStatus = "success" | "partial" | "failed";

// ─── Connector Domain Types ──────────────────────────────────────────────────

export interface MT5ConnectorRecord {
  id: string;
  user_id: string;
  connector_name: string;
  api_key_prefix: string;
  status: ConnectorStatus;
  last_heartbeat: string | null;
  last_ip: string | null;
  version: string | null;
  paired_accounts: number;
  created_at: string;
  revoked_at: string | null;
}

export interface MT5SyncBatchRecord {
  id: string;
  user_id: string;
  connector_id: string;
  account_id: string | null;
  batch_type: SyncBatchType;
  sync_type?: "ACCOUNT" | "HISTORY" | "RECONCILIATION";
  total_items: number;
  inserted_count: number;
  duplicate_count: number;
  error_count: number;
  error_details: Record<string, any>[] | null;
  duration_ms: number;
  status: SyncBatchStatus;
  started_at?: string | null;
  completed_at?: string | null;
  request_id?: string | null;
  error_code?: string | null;
  created_at: string;
}

// ─── API Endpoint Request & Response Payloads ────────────────────────────────

// 1. Pairing Endpoint (/api/mt5/pair)
export interface MT5PairingRequest {
  user_email: string;
  pairing_code?: string;
  connector_name?: string;
}

export interface MT5PairingResponse {
  connector_id: string;
  api_key: string; // Plaintext API key returned ONLY ONCE upon pairing
  api_key_prefix: string;
  connector_name: string;
  status: ConnectorStatus;
  created_at: string;
}

// 2. Heartbeat Endpoint (/api/mt5/heartbeat)
export interface MT5HeartbeatRequest {
  connector_id: string;
  version?: string;
  uptime_seconds?: number;
  connected_accounts?: string[];
}

export interface MT5HeartbeatResponse {
  status: "ok";
  server_time: string;
  next_heartbeat_seconds: number;
  active_accounts_count: number;
}

// 3. Account Sync Endpoint (/api/mt5/accounts/sync)
export interface MT5AccountSyncPayload {
  account_number: string;
  server: string;
  broker: string;
  account_type?: string;
  currency?: string;
  leverage?: string;
  balance: number;
  equity: number;
  free_margin?: number;
  margin?: number;
  margin_level?: number;
  name?: string;
}

export interface MT5AccountSyncRequest {
  connector_id: string;
  accounts: MT5AccountSyncPayload[];
}

export interface MT5AccountSyncResultItem {
  account_number: string;
  server: string;
  account_id: string;
  action: "created" | "updated" | "unchanged";
}

export interface MT5AccountSyncResponse {
  synced_total: number;
  created_count: number;
  updated_count: number;
  accounts: MT5AccountSyncResultItem[];
}

// 4. Trade Batch Ingestion Endpoint (/api/mt5/trades/batch)
export interface MT5TradeBatchPayload {
  deal_id: string; // Ticket number of closed deal in MT5
  order_id?: string;
  position_id?: string;
  symbol: string;
  side: "BUY" | "SELL" | "LONG" | "SHORT";
  volume: number;
  open_price: number;
  close_price: number;
  open_time: string; // ISO 8601 string
  close_time: string; // ISO 8601 string
  profit: number;
  commission?: number;
  swap?: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  magic_number?: number | null;
  comment?: string | null;
}

export interface MT5TradeBatchRequest {
  connector_id: string;
  account_number: string;
  server?: string;
  batch_type?: SyncBatchType;
  is_reconciliation?: boolean;
  trades: MT5TradeBatchPayload[];
}

export interface MT5TradeBatchResponse {
  batch_id: string;
  total_received: number;
  inserted_count: number;
  duplicate_count: number;
  reconciled_count?: number;
  error_count: number;
  error_details: { deal_id: string; reason: string }[];
  duration_ms: number;
  status: SyncBatchStatus;
}

export interface MT5ReconcileRequest {
  account_number: string;
  reconciliation_window_days?: number;
}

export interface MT5ReconcileResponse {
  account_number: string;
  status: "initiated" | "completed" | "already_running" | "error";
  missing_repaired: number;
  duplicates_skipped: number;
  total_processed: number;
  message: string;
}

// 5. Standard Envelope Response Wrapper
export interface MT5ApiResponseSuccess<T> {
  ok: true;
  data: T;
  timestamp: string;
}

export interface MT5ApiResponseError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export type MT5ApiResponse<T> = MT5ApiResponseSuccess<T> | MT5ApiResponseError;
