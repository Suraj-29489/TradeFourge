// types/database.ts
// Canonical TypeScript types that mirror the Supabase database schema.
// Used by all services and components for type safety.
// DO NOT add UI-specific fields here — keep this a pure DB mirror.

// ─── Trading Accounts ────────────────────────────────────────────────────────

export type AccountPlatform =
  | 'MetaTrader 4'
  | 'MetaTrader 5'
  | 'cTrader'
  | 'DXTrade'
  | 'TradeLocker'
  | 'Exness Terminal'
  | 'Match Trader'
  | 'Other';

export type AccountType = 'Live' | 'Demo' | 'Prop' | 'Contest';
export type LiveConnectionStatus = 'Connected' | 'Syncing' | 'Offline' | 'Error' | 'Reconnecting';
export type SyncIntervalSetting = '1m' | '5m' | '15m' | '1h' | 'manual';

export interface TradingAccount {
  id: string;
  user_id: string;
  display_id?: string | null;
  slug?: string | null;
  account_name: string;
  broker: string;
  platform: AccountPlatform;
  account_number: string | null;
  account_type: AccountType;
  currency: string;
  leverage: string | null;
  starting_balance: number;
  current_balance: number;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  is_live_synced?: boolean;
  live_status?: LiveConnectionStatus;
  last_synced_at?: string | null;
  sync_interval?: SyncIntervalSetting;
  created_at: string;
  updated_at: string;
}

export type NewTradingAccount = Omit<TradingAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type UpdateTradingAccount = Partial<NewTradingAccount>;

// ─── Live Sync Engine Models ──────────────────────────────────────────────────

export interface LiveBrokerCredential {
  id: string;
  user_id: string;
  account_id: string;
  broker_id: string;
  broker_name: string;
  platform: AccountPlatform;
  server: string;
  login_number: string;
  encrypted_auth_ref: string;
  sync_interval: SyncIntervalSetting;
  status: LiveConnectionStatus;
  last_sync_time: string | null;
  last_error: string | null;
  auto_currency_detected: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncCheckpoint {
  account_id: string;
  last_sync_time: string;
  last_trade_id: string | null;
  last_ticket: string | null;
  last_position_id: string | null;
}

export interface SyncLogEntry {
  id: string;
  user_id: string;
  account_id: string;
  account_name: string;
  broker: string;
  timestamp: string;
  trades_imported: number;
  trades_updated: number;
  trades_skipped: number;
  duration_ms: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  error_message?: string | null;
}

// ─── Trades ──────────────────────────────────────────────────────────────────

export type TradeSide = 'BUY' | 'SELL' | 'LONG' | 'SHORT';
export type TradeOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';
export type TradeSource = 'manual' | 'csv_import' | 'api';
export type TradeSession = 'London' | 'New York' | 'Tokyo' | 'Sydney' | 'London/NY Overlap' | 'Other';

export interface CloudTrade {
  id: string;
  user_id: string;
  account_id: string | null;
  ticket: string | null;

  // Core
  symbol: string;
  side: TradeSide;
  volume: number;

  // Prices
  open_price: number | null;
  close_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;

  // Time
  open_time: string | null;
  close_time: string | null;
  duration_seconds: number | null;

  // Financial
  profit: number;
  commission: number;
  swap: number;
  net_profit: number;
  rr_ratio: number | null;
  risk_amount: number | null;

  // Metadata
  outcome: TradeOutcome;
  source: TradeSource;
  session: TradeSession | null;
  strategy: string | null;
  notes: string | null;
  emotions: string | null;
  lessons: string | null;
  mistakes: string | null;
  magic_number: number | null;
  import_id?: string | null;

  created_at: string;
  updated_at: string;
}

export type NewCloudTrade = Omit<CloudTrade, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'net_profit'>;
export type UpdateCloudTrade = Partial<NewCloudTrade>;

// ─── Trade Relations ─────────────────────────────────────────────────────────

export interface TradeTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export type NewTradeTag = Omit<TradeTag, 'id' | 'user_id' | 'created_at'>;

export type TradeImageType = 'chart' | 'setup' | 'exit' | 'screenshot' | 'other';

export interface TradeImage {
  id: string;
  trade_id: string;
  user_id: string;
  storage_path: string;
  public_url: string;
  caption: string | null;
  image_type: TradeImageType;
  created_at: string;
}

export interface TradeChecklistItem {
  id: string;
  user_id: string;
  text: string;
  is_default: boolean;
}

export interface CloudTradeWithRelations extends CloudTrade {
  account?: TradingAccount | null;
  tags?: TradeTag[];
  images?: TradeImage[];
}

export interface TradeChecklistState {
  id: string;
  trade_id: string;
  checklist_item_id: string;
  is_checked: boolean;
  created_at: string;
}

export type TradeChecklist = TradeChecklistItem;
export type TradeChecklistCompletion = TradeChecklistState;

// ─── TradeFourge AI Coach (Future Architecture) ─────────────────────────────

export interface AICoachReview {
  id: string;
  user_id: string;
  date: string;
  discipline_score: number;
  consistency_score: number;
  risk_score: number;
  confidence_score: number;
  overall_rating: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
  behavior_analysis: string;
  emotional_detection: string[];
  rule_violations: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  ai_version: string;
  generated_at: string;
}

// ─── CSV Imports ──────────────────────────────────────────────────────────────

export type ImportStatus = 'pending' | 'processing' | 'success' | 'partial' | 'failed';

export interface CsvImport {
  id: string;
  user_id: string;
  account_id: string | null;
  filename: string;
  broker: string | null;
  platform: string | null;
  import_status: ImportStatus;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  duplicate_rows: number;
  failed_rows: number;
  error_log: string[] | null;
  notes: string | null;
  uploaded_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  account?: { id?: string; account_name: string; currency: string; broker?: string; platform?: string } | null;
}

export type NewCsvImport = Omit<CsvImport, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type UpdateCsvImport = Partial<Omit<NewCsvImport, 'uploaded_at'>>;

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── Cloud Trade Filters ──────────────────────────────────────────────────────

export interface CloudTradeFilters {
  search: string;
  side: TradeSide | 'ALL';
  outcome: TradeOutcome | 'ALL';
  source: TradeSource | 'ALL';
  session: TradeSession | 'ALL';
  accountId: string | 'ALL';
  accountIds?: string[];
  dateRange: '7D' | '30D' | '90D' | 'THIS_MONTH' | 'THIS_YEAR' | 'ALL';
  startDate?: string;
  endDate?: string;
  symbol?: string;
  tagId?: string;
  strategy?: string;
}

export const DEFAULT_CLOUD_FILTERS: CloudTradeFilters = {
  search: '',
  side: 'ALL',
  outcome: 'ALL',
  source: 'ALL',
  session: 'ALL',
  accountId: 'ALL',
  accountIds: ['ALL'],
  dateRange: 'ALL',
};
