export type Direction = "LONG" | "SHORT";
export type TradeStatus = "WIN" | "LOSS" | "BREAKEVEN";

export type AccountCurrency = "USD" | "USC" | "INR";
export type AccountType = "Standard" | "Standard Cent" | "Raw" | "Pro" | "Demo";

export interface Trade {
  id: string;
  positionId: string;
  openTime: string; // ISO date string
  closeTime: string; // ISO date string
  symbol: string;
  direction: Direction;
  lot: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  commission: number;
  swap: number;
  rr: number; // Risk:Reward ratio
  status: TradeStatus;
  account: string;
  accountType?: AccountType;
  currency?: AccountCurrency;
  broker: string;
  notes?: string;
  tags?: string[];
  holdDurationMs?: number; // Calculated hold time in ms
}

export interface TradeStats {
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  totalNetProfit: number;
  grossProfit: number;
  grossLoss: number;
  balance: number;
  winRate: number; // percentage 0 - 100
  lossRate: number; // percentage 0 - 100
  profitFactor: number;
  expectancy: number; // $ expected return per trade
  averageRR: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  averageHoldTime: string; // Formatted string e.g. "2h 45m"
  currentStreak: { type: "WIN" | "LOSS" | "NONE"; count: number };
  bestStreak: number;
  worstStreak: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  totalCommission: number;
  totalSwap: number;
}

export interface EquityPoint {
  date: string;
  pnl: number;
  equity: number;
  tradeCount: number;
}

export interface DailyPnLPoint {
  date: string;
  pnl: number;
  trades: number;
  winRate: number;
}

export interface MonthlyPnLPoint {
  month: string;
  pnl: number;
  trades: number;
}

export interface ProfitDistributionPoint {
  range: string;
  count: number;
}

export interface DrawdownPoint {
  date: string;
  drawdown: number;
  drawdownPercent: number;
}

export interface FilterOptions {
  search: string;
  symbol: string;
  direction: Direction | "ALL";
  status: TradeStatus | "ALL";
  dateRange: "ALL" | "7D" | "30D" | "90D" | "THIS_MONTH" | "THIS_YEAR";
}

export interface UserSettings {
  currency: AccountCurrency;
  timezone: string;
  dateFormat: "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
  theme: "dark" | "light";
  initialBalance: number;
  sidebarCollapsed: boolean;
  accountBalance: number | null;
}

export interface JournalHistoryItem {
  id: string;
  filename: string;
  uploadDate: string;
  tradeCount: number;
  broker: string;
  currency: AccountCurrency;
  accountType: AccountType;
  accountName: string;
}

export interface ColumnVisibility {
  date: boolean;
  time: boolean;
  ticket: boolean;
  symbol: boolean;
  direction: boolean;
  lot: boolean;
  entry: boolean;
  exit: boolean;
  pnl: boolean;
  commission: boolean;
  swap: boolean;
  rr: boolean;
  status: boolean;
}

export interface BrokerParser {
  id: string;
  name: string;
  description: string;
  parse: (csvText: string, accountName?: string) => ParseResult;
}

export interface ParseResult {
  success: boolean;
  trades: Trade[];
  detectedCurrency: AccountCurrency;
  detectedAccountType: AccountType;
  errors: string[];
  totalParsed: number;
}
