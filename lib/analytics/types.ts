// lib/analytics/types.ts
// TradeFourge v3.8 Analytics Engine — Universal Type Definitions

export interface TradeInput {
  id?: string;
  ticket?: string | null;
  symbol: string;
  side: "BUY" | "SELL" | "LONG" | "SHORT";
  volume: number;
  openPrice?: number | null;
  closePrice?: number | null;
  openTime?: string | null;
  closeTime?: string | null;
  profit: number;
  commission?: number | null;
  swap?: number | null;
  rr?: number | null;
  outcome?: "WIN" | "LOSS" | "BREAKEVEN" | string | null;
}

export interface EquityPoint {
  timestamp: string;
  tradeIndex: number;
  profit: number;
  balance: number;
  equity: number;
  peakEquity: number;
  drawdown: number;
  drawdownPercent: number;
}

export interface DrawdownMetrics {
  maxDrawdownAmount: number;
  maxDrawdownPercent: number;
  relativeDrawdownPercent: number;
  drawdownCurve: { timestamp: string; drawdown: number; drawdownPercent: number }[];
}

export interface CorePerformanceMetrics {
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  expectancy: number;
  averageTrade: number;
  averageWinner: number;
  averageLoser: number;
  largestWinner: number;
  largestLoser: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  totalTrades: number;
}

export interface CategoryBreakdown {
  category: string;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  netProfit: number;
}

export interface WinLossMetrics {
  overallWinRate: number;
  bySymbol: Record<string, CategoryBreakdown>;
  byDay: Record<string, CategoryBreakdown>;
  byWeek: Record<string, CategoryBreakdown>;
  byMonth: Record<string, CategoryBreakdown>;
  longVsShort: {
    long: CategoryBreakdown;
    short: CategoryBreakdown;
  };
  buyVsSell: {
    buy: CategoryBreakdown;
    sell: CategoryBreakdown;
  };
}

export interface RiskMetrics {
  maxDrawdownAmount: number;
  maxDrawdownPercent: number;
  relativeDrawdownPercent: number;
  recoveryFactor: number;
  sharpeRatio: number;
  riskRewardRatio: number;
}

export interface RMultipleBucket {
  bucketLabel: string;
  count: number;
  percentage: number;
}

export interface SessionMetrics {
  session: "Asian" | "London" | "New York" | "Overlap";
  totalTrades: number;
  winRate: number;
  netProfit: number;
}

export interface TimeAnalyticsMetrics {
  averageHoldDurationSeconds: number;
  medianHoldDurationSeconds: number;
  minHoldDurationSeconds: number;
  maxHoldDurationSeconds: number;
  sessions: SessionMetrics[];
  bestTradingHour: { hour: number; netProfit: number; winRate: number };
  bestWeekday: { day: string; netProfit: number; winRate: number };
}

export interface ReturnsMetrics {
  monthlyReturns: { monthYear: string; year: number; month: number; netProfit: number; percentageReturn: number }[];
  dailyReturns: { date: string; netProfit: number; tradeCount: number }[];
}

export interface SymbolAnalyticsItem {
  symbol: string;
  tradeCount: number;
  totalVolume: number;
  netProfit: number;
  winRate: number;
  averageProfit: number;
}

export interface SymbolAnalyticsMetrics {
  symbols: Record<string, SymbolAnalyticsItem>;
  bestSymbol: SymbolAnalyticsItem | null;
  worstSymbol: SymbolAnalyticsItem | null;
  totalVolume: number;
}

export interface ChartDistributions {
  equityCurveChart: { timestamp: string; equity: number; balance: number; peak: number }[];
  drawdownChart: { timestamp: string; drawdown: number; drawdownPercent: number }[];
  monthlyReturnsChart: { month: string; year: number; profit: number; percentage: number }[];
  dailyHeatmapChart: { date: string; value: number; count: number }[];
  winDistributionChart: { label: string; count: number; percentage: number }[];
  profitDistributionChart: { binLabel: string; count: number; totalProfit: number }[];
}

export interface CompleteAnalyticsReport {
  totalTrades: number;
  initialBalance: number;
  endingBalance: number;
  equityCurve: EquityPoint[];
  drawdown: DrawdownMetrics;
  corePerformance: CorePerformanceMetrics;
  winLoss: WinLossMetrics;
  risk: RiskMetrics;
  rMultipleDistribution: RMultipleBucket[];
  timeAnalytics: TimeAnalyticsMetrics;
  returns: ReturnsMetrics;
  symbolAnalytics: SymbolAnalyticsMetrics;
  charts: ChartDistributions;
}
