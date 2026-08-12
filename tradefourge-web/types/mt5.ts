export type MT5ConnectionStatus = "Connected" | "Connecting" | "Disconnected" | "Error" | "Syncing";

export type MT5AccountType = "Standard" | "Standard Cent" | "Raw Spread" | "Zero" | "Pro" | "Other";

export type MT5Currency = "USD" | "USC" | "EUR" | "Other";

export type MT5Timeframe = "1H" | "4H" | "1D" | "1W" | "1M";

export interface MT5Account {
  id: string;
  accountNumber: string;
  password?: string;
  server: string;
  accountType: MT5AccountType;
  currency: MT5Currency;
  leverage: string;
  balance: number;
  equity: number;
  freeMargin: number;
  margin?: number;
  marginLevel?: number | null;
  floatingPnl: number;
  profitToday: number;
  connectionStatus: MT5ConnectionStatus;
  lastUpdated: string;
  connectorId?: string;
  isPaired?: boolean;
}

export interface MT5Trade {
  ticket: string;
  orderId: string;
  accountNumber: string;
  symbol: "XAUUSD" | "BTCUSD" | "EURUSD" | "GBPUSD" | "USDJPY" | string;
  side: "BUY" | "SELL";
  volume: number;
  openTime: string;
  closeTime: string | null;
  openPrice: number;
  closePrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  commission: number;
  swap: number;
  profit: number;
  status: "OPEN" | "CLOSED";
  dealId?: string;
  positionId?: string;
}

export interface MT5EquityPoint {
  timestamp: string;
  equity: number;
  balance: number;
}

export interface MT5TradeFilter {
  startDate?: string;
  endDate?: string;
  search?: string;
  symbol?: string;
  side?: "ALL" | "BUY" | "SELL";
  status?: "ALL" | "OPEN" | "CLOSED";
}

export interface MT5Settings {
  defaultAccountId: string;
  autoRefresh: boolean;
  autoRefreshInterval: number; // seconds (30, 60, 300, 600)
  defaultHistoryRange: "Recent Trades" | "Last 7 Days" | "Last 30 Days" | "All Available";
  defaultTradeSide: "ALL" | "BUY" | "SELL";
  timeFormat: "12h" | "24h";
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  timezone: "Account Time" | "Local Time" | "UTC";
  currency: MT5Currency;
}

export interface MT5LivePosition {
  positionId: string;
  ticket: string;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  openTime: string;
  openPrice: number;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  profit: number;
  swap: number;
  magic: number | null;
  comment: string | null;
}

export interface MT5LiveAccountState {
  accountId: string;
  accountNumber: string;
  observedAt: string;
  receivedAt: string;
  balance: number;
  equity: number;
  floatingPnl: number;
  margin: number;
  freeMargin: number;
  marginLevel: number | null;
  isConnected: boolean;
  isStale: boolean;
  lastUpdateSecAgo: number;
  openPositionCount: number;
  positions: MT5LivePosition[];
}

export interface MT5DataProvider {
  getAccounts(): Promise<MT5Account[]>;
  getAccount(accountId: string): Promise<MT5Account | null>;
  addAccount(account: Omit<MT5Account, "id" | "balance" | "equity" | "freeMargin" | "floatingPnl" | "profitToday" | "connectionStatus" | "lastUpdated"> & { password?: string }): Promise<MT5Account>;
  refreshAccount(accountId: string): Promise<MT5Account>;
  disconnectAccount(accountId: string): Promise<boolean>;
  getTrades(accountId: string, filter?: MT5TradeFilter): Promise<MT5Trade[]>;
  fetchHistoricalTrades(accountId: string, fromDate: string, toDate: string): Promise<{ addedCount: number }>;
  getEquityHistory(accountId: string, timeframe: MT5Timeframe): Promise<{
    points: MT5EquityPoint[];
    startingBalance: number;
    currentEquity: number;
    high: number;
    low: number;
  }>;
}

