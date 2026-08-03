// lib/analytics/risk/risk-metrics.ts
// Phase 4 — Pure Risk Analytics (Max Drawdown, Recovery Factor, Sharpe Ratio, Risk:Reward)

import { TradeInput, EquityPoint, RiskMetrics } from "../types";
import { calculateDrawdownMetrics } from "../equity/drawdown";

/**
 * Calculates risk ratios including Recovery Factor, Sharpe Ratio, and Risk:Reward.
 * Pure function: Input (trades, equityPoints, initialBalance) -> Output RiskMetrics
 */
export function calculateRiskMetrics(
  trades: TradeInput[],
  equityPoints: EquityPoint[],
  initialBalance = 10000
): RiskMetrics {
  const dd = calculateDrawdownMetrics(equityPoints);

  if (!trades || trades.length === 0) {
    return {
      maxDrawdownAmount: 0,
      maxDrawdownPercent: 0,
      relativeDrawdownPercent: 0,
      recoveryFactor: 0,
      sharpeRatio: 0,
      riskRewardRatio: 0,
    };
  }

  // Net Profit
  const totalNetProfit = trades.reduce((sum, t) => sum + (t.profit || 0) - Math.abs(t.commission || 0) + (t.swap || 0), 0);

  // Recovery Factor = Net Profit / Max Drawdown Amount
  const recoveryFactor = dd.maxDrawdownAmount > 0
    ? parseFloat((totalNetProfit / dd.maxDrawdownAmount).toFixed(2))
    : totalNetProfit > 0 ? 99 : 0;

  // Average Win vs Average Loss for Risk:Reward Ratio
  const wins = trades
    .map((t) => (t.profit || 0) - Math.abs(t.commission || 0) + (t.swap || 0))
    .filter((p) => p > 0.001);

  const losses = trades
    .map((t) => (t.profit || 0) - Math.abs(t.commission || 0) + (t.swap || 0))
    .filter((p) => p < -0.001);

  const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;

  const riskRewardRatio = avgLoss > 0 ? parseFloat((avgWin / avgLoss).toFixed(2)) : avgWin > 0 ? 99 : 0;

  // Basic Sharpe Ratio = (Mean Returns / StdDev Returns) * Math.sqrt(252)
  const returns = trades.map((t) => (t.profit || 0) - Math.abs(t.commission || 0) + (t.swap || 0));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  const sharpeRatio = stdDev > 0 ? parseFloat(((mean / stdDev) * Math.sqrt(Math.min(252, trades.length))).toFixed(2)) : 0;

  return {
    maxDrawdownAmount: dd.maxDrawdownAmount,
    maxDrawdownPercent: dd.maxDrawdownPercent,
    relativeDrawdownPercent: dd.relativeDrawdownPercent,
    recoveryFactor,
    sharpeRatio,
    riskRewardRatio,
  };
}
