/**
 * TradeFourge Companion v5.5.3 — Message Protocol Definitions
 * Strongly-typed bidirectional communication envelope for Web ↔ Extension Bridge.
 */

export const TF_SOURCE_WEB = "tradefourge-web" as const;
export const TF_SOURCE_EXTENSION = "tradefourge-extension" as const;

export type TFSource = typeof TF_SOURCE_WEB | typeof TF_SOURCE_EXTENSION;

export const TF_MESSAGE_TYPES = {
  // Handshake & Diagnostics
  PING: "PING",
  PONG: "PONG",
  GET_EXTENSION_INFO: "GET_EXTENSION_INFO",
  GET_BROWSER_INFO: "GET_BROWSER_INFO",
  HEARTBEAT: "HEARTBEAT",

  // Account Discovery
  DISCOVER_ACCOUNTS: "DISCOVER_ACCOUNTS",
  ACCOUNT_DISCOVERED: "ACCOUNT_DISCOVERED",
  ACCOUNT_LIST: "ACCOUNT_LIST",

  // History Synchronization Pipeline
  IMPORT_SELECTED_ACCOUNTS: "IMPORT_SELECTED_ACCOUNTS",
  IMPORT_STARTED: "IMPORT_STARTED",
  IMPORT_PROGRESS: "IMPORT_PROGRESS",
  IMPORT_COMPLETED: "IMPORT_COMPLETED",

  // Live Realtime Event Pipeline
  LIVE_EVENT: "LIVE_EVENT",
  ACCOUNT_UPDATED: "ACCOUNT_UPDATED",
  BALANCE_UPDATED: "BALANCE_UPDATED",
  EQUITY_UPDATED: "EQUITY_UPDATED",
  POSITION_OPENED: "POSITION_OPENED",
  POSITION_MODIFIED: "POSITION_MODIFIED",
  POSITION_CLOSED: "POSITION_CLOSED",

  // Lifecycle Recovery & Diagnostics
  HEALTH_CHECK: "HEALTH_CHECK",
  RECONNECT: "RECONNECT",
  STATE_CHANGE: "STATE_CHANGE",

  // Error Handling
  ERROR: "ERROR",
} as const;

export type TFMessageType = keyof typeof TF_MESSAGE_TYPES;

export interface TFMessageError {
  code:
    | "EXTENSION_MISSING"
    | "EXTENSION_DISABLED"
    | "EXTENSION_OUTDATED"
    | "BROWSER_UNSUPPORTED"
    | "EXNESS_NOT_OPEN"
    | "CONTENT_SCRIPT_UNREACHABLE"
    | "MALFORMED_ACCOUNT_PAYLOAD"
    | "NO_ACCOUNTS_FOUND"
    | "IMPORT_FAILED"
    | "HISTORY_INTERRUPTED"
    | "CONNECTION_LOST"
    | "CONTEXT_INVALIDATED"
    | "TIMEOUT"
    | "PERMISSION_DENIED"
    | "UNKNOWN_ERROR";
  message: string;
  stage?: string;
  reason?: string;
  suggestedAction?: string;
  details?: any;
}

export interface TFMessageEnvelope<T = any> {
  source: TFSource;
  type: TFMessageType;
  requestId: string;
  timestamp: number;
  version: string;
  payload?: T;
  error?: TFMessageError;
}

// Formal Connection Machine States (Phase 8)
export type ConnectionState =
  | "Disconnected"
  | "Connecting"
  | "Injected"
  | "Connected"
  | "Authenticated"
  | "Streaming"
  | "Error"
  | "Recovering";

// Discovered Account Model from Extension
export interface DiscoveredAccount {
  id?: string;
  account_number: string;
  account_name: string;
  nickname?: string;
  broker: string;
  platform: string;
  currency: string;
  balance: number;
  equity?: number;
  server: string;
  account_type: string;
  account_type_raw?: string;
  leverage?: string;
  history_count: number;
  status: "Ready" | "Syncing" | "Offline";
  is_archived?: boolean;
  is_live?: boolean;
  is_demo?: boolean;
}

// Import Progress Payload Model
export interface ImportProgressPayload {
  account_number?: string;
  fetchedTrades: number;
  totalTrades: number;
  offset: number;
  percentage: number;
  stage:
    | "connecting"
    | "discovering"
    | "fetching_history"
    | "importing"
    | "building_analytics"
    | "request_history"
    | "receiving_batches"
    | "writing_database"
    | "verifying"
    | "completed"
    | "complete";
  message?: string;
}

// Live Trade Event Payload Model
export interface LiveTradeEventPayload {
  eventType: "POSITION_OPENED" | "POSITION_MODIFIED" | "POSITION_CLOSED" | "BALANCE_UPDATED" | "EQUITY_UPDATED";
  ticket: string;
  account_number: string;
  symbol?: string;
  type?: "BUY" | "SELL";
  lots?: number;
  openPrice?: number;
  closePrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl?: number;
  balance?: number;
  equity?: number;
  timestamp: string;
}
