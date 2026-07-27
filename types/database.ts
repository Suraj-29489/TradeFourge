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
  | 'Other';

export type AccountType = 'Live' | 'Demo' | 'Prop' | 'Contest';

export interface TradingAccount {
  id: string;
  user_id: string;
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
  created_at: string;
  updated_at: string;
}

export type NewTradingAccount = Omit<TradingAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type UpdateTradingAccount = Partial<NewTradingAccount>;

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
  taxes: number;
  net_profit: number; // computed column

  // Risk
  risk_amount: number | null;
  reward_amount: number | null;
  risk_percent: number | null;
  rr_ratio: number | null;

  // Performance
  pips: number | null;
  outcome: TradeOutcome | null;
  mfe: number | null;
  mae: number | null;

  // Journal
  strategy: string | null;
  setup: string | null;
  market_condition: string | null;
  session: TradeSession | null;
  notes: string | null;
  emotions: string | null;
  lessons: string | null;
  mistakes: string | null;
  confidence_rating: number | null;

  // Media
  screenshot_url: string | null;
  chart_url: string | null;

  // Import metadata
  source: TradeSource;
  import_id: string | null;
  imported_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// CloudTrade with joined relations (tags, images, account name)
export interface CloudTradeWithRelations extends CloudTrade {
  account?: Pick<TradingAccount, 'id' | 'account_name' | 'broker' | 'currency'> | null;
  tags?: TradeTag[];
  images?: TradeImage[];
}

export type NewCloudTrade = Omit<
  CloudTrade,
  'id' | 'user_id' | 'net_profit' | 'created_at' | 'updated_at'
>;
export type UpdateCloudTrade = Partial<NewCloudTrade>;

// ─── Trade Filters ────────────────────────────────────────────────────────────

export interface CloudTradeFilters {
  search: string;
  symbol: string;
  side: TradeSide | 'ALL';
  outcome: TradeOutcome | 'ALL';
  dateRange: 'ALL' | '7D' | '30D' | '90D' | 'THIS_MONTH' | 'THIS_YEAR';
  accountId: string | 'ALL';
  source: TradeSource | 'ALL';
}

export const DEFAULT_CLOUD_FILTERS: CloudTradeFilters = {
  search: '',
  symbol: '',
  side: 'ALL',
  outcome: 'ALL',
  dateRange: 'ALL',
  accountId: 'ALL',
  source: 'ALL',
};

// ─── Trade Tags ───────────────────────────────────────────────────────────────

export interface TradeTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export type NewTradeTag = Pick<TradeTag, 'name' | 'color'>;

// ─── Trade Images ─────────────────────────────────────────────────────────────

export type TradeImageType = 'entry' | 'exit' | 'chart' | 'analysis' | 'screenshot' | 'other';

export interface TradeImage {
  id: string;
  user_id: string;
  trade_id: string;
  image_type: TradeImageType;
  storage_path: string;
  public_url: string;
  caption: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

// ─── Trade Checklists ─────────────────────────────────────────────────────────

export interface TradeChecklist {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TradeChecklistItem {
  id: string;
  checklist_id: string;
  text: string;
  sort_order: number;
  created_at: string;
}

export interface TradeChecklistCompletion {
  id: string;
  trade_id: string;
  checklist_item_id: string;
  is_checked: boolean;
  created_at: string;
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
