// lib/analytics/index.ts
// TradeFourge v3.8 Analytics Engine — Unified Entry Point
// Aggregates all pure analytics calculation modules across Phases 1 through 7.

export * from "./types";
export * from "./equity/equity-curve";
export * from "./equity/drawdown";
export * from "./performance/core-performance";
export * from "./performance/win-loss";
export * from "./risk/risk-metrics";
export * from "./risk/r-multiple";
export * from "./time/time-analytics";
export * from "./time/returns";
export * from "./symbol/symbol-analytics";
export * from "./distribution/chart-distributions";

import { TradeInput, CompleteAnalyticsReport } from "./types";
import { calculateEquityAndBalanceCurve } from "./equity/equity-curve";
import { calculateDrawdownMetrics } from "./equity/drawdown";
import { calculateCorePerformance } from "./performance/core-performance";
import { calculateWinLossBreakdowns } from "./performance/win-loss";
import { calculateRiskMetrics } from "./risk/risk-metrics";
import { calculateRMultipleDistribution } from "./risk/r-multiple";
import { calculateTimeAnalytics } from "./time/time-analytics";
import { calculateReturns } from "./time/returns";
import { calculateSymbolAnalytics } from "./symbol/symbol-analytics";
import { generateChartDistributions } from "./distribution/chart-distributions";

/**
 * Main Pure Calculation Engine Entry Point
 * Transforms imported trade data into a complete, structured analytics report.
 * Pure function: Input (trades: TradeInput[], initialBalance: number) -> Output CompleteAnalyticsReport
 */
export function computeTradeAnalytics(
  trades: TradeInput[],
  initialBalance = 10000
): CompleteAnalyticsReport {
  const equityCurve = calculateEquityAndBalanceCurve(trades, initialBalance);
  const drawdown = calculateDrawdownMetrics(equityCurve);
  const corePerformance = calculateCorePerformance(trades);
  const winLoss = calculateWinLossBreakdowns(trades);
  const risk = calculateRiskMetrics(trades, equityCurve, initialBalance);
  const rMultipleDistribution = calculateRMultipleDistribution(trades);
  const timeAnalytics = calculateTimeAnalytics(trades);
  const returns = calculateReturns(trades, initialBalance);
  const symbolAnalytics = calculateSymbolAnalytics(trades);
  const charts = generateChartDistributions(trades, equityCurve, initialBalance);

  const endingBalance = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].balance : initialBalance;

  return {
    totalTrades: trades.length,
    initialBalance,
    endingBalance,
    equityCurve,
    drawdown,
    corePerformance,
    winLoss,
    risk,
    rMultipleDistribution,
    timeAnalytics,
    returns,
    symbolAnalytics,
    charts,
  };
}
