export type Direction = "LONG" | "SHORT";
export type TradeStatus = "WIN" | "LOSS" | "BREAKEVEN";

export type AccountCurrency = "USD" | "USC" | "INR";
export type AccountType = "Standard" | "Standard Cent" | "Raw" | "Pro" | "Demo";
export type BrokerType = "Exness" | "MetaTrader 5" | "TradeLocker" | "TradeZella" | "Generic Broker";

export interface NormalizedTrade {
  ticket: string; // Unique position ticket / ID
  openTime: string | null; // ISO string
  closeTime: string; // ISO string
  symbol: string;
  direction: Direction;
  volume: number;
  openPrice: number | null;
  closePrice: number;
  commission: number;
  swap: number;
  profit: number; // Realized Net PnL in USD
  currency: "USD";
  accountType: AccountType;
  accountName: string;
  broker: BrokerType;
  comment?: string;
  magic?: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
  rr: number | null; // Strictly null if SL/TP unavailable (renders N/A)
  status: TradeStatus;
  holdDurationMs: number | null; // Strictly null if openTime unavailable (renders N/A)
  balanceAfterTrade?: number | null;
  closeReason?: string;
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

export interface DrawdownPoint {
  date: string;
  drawdown: number;
  drawdownPercent: number;
}

export interface ProfitDistributionPoint {
  range: string;
  count: number;
}

export interface EngineStats {
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  balance: number;
  winRate: number; // percentage 0-100
  lossRate: number; // percentage 0-100
  breakevenCount: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  profitFactor: number;
  expectancy: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  averageRR: number | null; // null if no valid RRs
  averageHoldTime: string; // "N/A" or formatted time
  currentStreak: { type: "WIN" | "LOSS" | "NONE"; count: number };
  bestStreak: number;
  worstStreak: number;
  totalCommission: number;
  totalSwap: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
}

export interface ParseValidationResult {
  success: boolean;
  trades: NormalizedTrade[];
  broker: BrokerType;
  currency: "USD";
  accountType: AccountType;
  csvTotalProfit: number;
  normalizedTotalProfit: number;
  isMatch: boolean;
  delta: number;
  warningMessage: string | null;
  errors: string[];
  lastKnownBalance: number | null; // Last equity value from the CSV
}
