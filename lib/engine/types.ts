export type Direction = "LONG" | "SHORT";
export type TradeStatus = "WIN" | "LOSS" | "BREAKEVEN";

export type AccountCurrency = "USD" | "USC" | "EUR" | "INR";
export type AccountType = "Standard" | "Standard Cent" | "Raw" | "Pro" | "Demo";
export type BrokerType = "Exness" | "MetaTrader 5" | "TradeLocker" | "TradeZella" | "Generic Broker";

export interface NormalizedTrade {
  ticket: string;
  openTime: string | null;
  closeTime: string;
  symbol: string;
  direction: Direction;
  volume: number;
  openPrice: number | null;
  closePrice: number;
  commission: number;
  swap: number;
  profit: number;
  currency: AccountCurrency;
  accountType: AccountType;
  accountName: string;
  broker: BrokerType;
  comment?: string;
  magic?: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
  rr: number | null;
  status: TradeStatus;
  holdDurationMs: number | null;
  balanceAfterTrade?: number | null; // Running balance in USD
  closeReason?: string;
  journalId?: string;    // Parent journal reference
}

/**
 * A fully self-contained imported journal.
 * ALL monetary values (profit, commission, swap, balanceAfterTrade, lastKnownBalance)
 * are stored internally in USD. USC (cent) accounts are normalized on import (÷100).
 */
export interface Journal {
  id: string;
  filename: string;
  displayName: string;   // User-editable label (defaults to filename)
  uploadDate: string;
  accountName: string;
  trades: NormalizedTrade[];
  tradeCount: number;
  broker: BrokerType;
  accountType: AccountType;
  isCentAccount: boolean;         // true = USC account, already normalized to USD
  lastKnownBalance: number | null; // Last equity value in USD
  dateFrom: string | null;         // ISO closeTime of earliest trade
  dateTo: string | null;           // ISO closeTime of latest trade
}

/* ─── Chart Point Types ──────────────────────────────────────────────────── */

export interface EquityPoint {
  date: string;
  pnl: number;
  equity: number;
  tradeCount: number;
  isReconstructed?: boolean;
}

export interface EquityCurveResult {
  points: EquityPoint[];
  isReconstructed: boolean; // true = no real balance, reconstructed from cumulative PnL
}

export interface DailyPnLPoint {
  date: string;
  pnl: number;
  trades: number;
  winRate: number;
}

export interface WeeklyPnLPoint {
  week: string;
  pnl: number;
  trades: number;
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

export interface HourlyPerformancePoint {
  hour: string;
  pnl: number;
  trades: number;
  winRate: number;
}

export interface WeekdayPerformancePoint {
  day: string;
  pnl: number;
  trades: number;
  winRate: number;
}

/* ─── Aggregate Statistics ───────────────────────────────────────────────── */

export interface EngineStats {
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  balance: number;
  winRate: number;
  lossRate: number;
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
  averageRR: number | null;
  averageHoldTime: string;
  currentStreak: { type: "WIN" | "LOSS" | "NONE"; count: number };
  bestStreak: number;
  worstStreak: number;
  totalCommission: number;
  totalSwap: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
}

/* ─── Parser Result ──────────────────────────────────────────────────────── */

export interface ParseValidationResult {
  success: boolean;
  trades: NormalizedTrade[];
  broker: BrokerType;
  currency: AccountCurrency;
  accountType: AccountType;
  isCentAccount: boolean;
  csvTotalProfit: number;         // Raw sum from CSV (pre-normalization)
  normalizedTotalProfit: number;  // Sum after normalization
  isMatch: boolean;
  delta: number;
  warningMessage: string | null;
  errors: string[];
  lastKnownBalance: number | null; // Last equity in USD (already normalized)
}
