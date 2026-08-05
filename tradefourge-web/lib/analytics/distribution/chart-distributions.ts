// lib/analytics/distribution/chart-distributions.ts
// Phase 7 — Pure Chart Data Distributions Engine

import { TradeInput, EquityPoint, ChartDistributions } from "../types";
import { calculateReturns } from "../time/returns";
import { calculateRMultipleDistribution } from "../risk/r-multiple";

/**
 * Generates formatted chart data arrays for Equity Curve, Drawdown, Monthly Returns, Daily Heatmap, Win Distribution, Profit Distribution.
 * Pure function: Input (trades, equityPoints, initialBalance) -> Output ChartDistributions
 */
export function generateChartDistributions(
  trades: TradeInput[],
  equityPoints: EquityPoint[],
  initialBalance = 10000
): ChartDistributions {
  // 1. Equity Curve Chart Data
  const equityCurveChart = equityPoints.map((pt) => ({
    timestamp: pt.timestamp,
    equity: pt.equity,
    balance: pt.balance,
    peak: pt.peakEquity,
  }));

  // 2. Drawdown Chart Data
  const drawdownChart = equityPoints.map((pt) => ({
    timestamp: pt.timestamp,
    drawdown: pt.drawdown,
    drawdownPercent: pt.drawdownPercent,
  }));

  // 3. Monthly Returns & Daily Heatmap Data
  const returnsData = calculateReturns(trades, initialBalance);
  const monthlyReturnsChart = returnsData.monthlyReturns.map((m) => ({
    month: m.monthYear,
    year: m.year,
    profit: m.netProfit,
    percentage: m.percentageReturn,
  }));

  const dailyHeatmapChart = returnsData.dailyReturns.map((d) => ({
    date: d.date,
    value: d.netProfit,
    count: d.tradeCount,
  }));

  // 4. Win Distribution Chart Data
  const wins = trades.filter((t) => ((t.profit || 0) - Math.abs(t.commission || 0) + (t.swap || 0)) > 0.001).length;
  const losses = trades.filter((t) => ((t.profit || 0) - Math.abs(t.commission || 0) + (t.swap || 0)) < -0.001).length;
  const breakevens = trades.length - wins - losses;
  const total = trades.length || 1;

  const winDistributionChart = [
    { label: "Wins", count: wins, percentage: parseFloat(((wins / total) * 100).toFixed(1)) },
    { label: "Losses", count: losses, percentage: parseFloat(((losses / total) * 100).toFixed(1)) },
    { label: "Breakeven", count: breakevens, percentage: parseFloat(((breakevens / total) * 100).toFixed(1)) },
  ];

  // 5. Profit Distribution Chart Data (R-Multiple Bins)
  const rBuckets = calculateRMultipleDistribution(trades);
  const profitDistributionChart = rBuckets.map((b) => ({
    binLabel: b.bucketLabel,
    count: b.count,
    totalProfit: b.percentage,
  }));

  return {
    equityCurveChart,
    drawdownChart,
    monthlyReturnsChart,
    dailyHeatmapChart,
    winDistributionChart,
    profitDistributionChart,
  };
}
