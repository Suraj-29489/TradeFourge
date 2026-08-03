// lib/analytics/performance/core-performance.ts
// Phase 2 — Pure Core Performance Analytics (Net Profit, Profit Factor, Expectancy, Averages, Extremes)

import { TradeInput, CorePerformanceMetrics } from "../types";

/**
 * Calculates core financial metrics from trade array.
 * Pure function: Input TradeInput[] -> Output CorePerformanceMetrics
 */
export function calculateCorePerformance(trades: TradeInput[]): CorePerformanceMetrics {
  if (!trades || trades.length === 0) {
    return {
      netProfit: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      averageTrade: 0,
      averageWinner: 0,
      averageLoser: 0,
      largestWinner: 0,
      largestLoser: 0,
      winCount: 0,
      lossCount: 0,
      breakevenCount: 0,
      totalTrades: 0,
    };
  }

  let grossProfit = 0;
  let grossLoss = 0;
  let winCount = 0;
  let lossCount = 0;
  let breakevenCount = 0;
  let largestWinner = 0;
  let largestLoser = 0;

  trades.forEach((trade) => {
    const profit = trade.profit || 0;
    const comm = trade.commission || 0;
    const swap = trade.swap || 0;
    const netPnL = parseFloat((profit - Math.abs(comm) + swap).toFixed(2));

    if (netPnL > 0.001) {
      grossProfit += netPnL;
      winCount++;
      if (netPnL > largestWinner) largestWinner = netPnL;
    } else if (netPnL < -0.001) {
      grossLoss += netPnL; // negative value
      lossCount++;
      if (netPnL < largestLoser) largestLoser = netPnL;
    } else {
      breakevenCount++;
    }
  });

  const totalTrades = trades.length;
  const netProfit = parseFloat((grossProfit + grossLoss).toFixed(2));
  const absGrossLoss = Math.abs(grossLoss);

  const profitFactor = absGrossLoss > 0 ? parseFloat((grossProfit / absGrossLoss).toFixed(2)) : grossProfit > 0 ? 999 : 0;

  const winRateRatio = totalTrades > 0 ? winCount / totalTrades : 0;
  const lossRateRatio = totalTrades > 0 ? lossCount / totalTrades : 0;

  const averageTrade = totalTrades > 0 ? parseFloat((netProfit / totalTrades).toFixed(2)) : 0;
  const averageWinner = winCount > 0 ? parseFloat((grossProfit / winCount).toFixed(2)) : 0;
  const averageLoser = lossCount > 0 ? parseFloat((grossLoss / lossCount).toFixed(2)) : 0;

  // Expectancy = (Win Rate * Avg Win) - (Loss Rate * Math.abs(Avg Loss))
  const expectancy = parseFloat((winRateRatio * averageWinner + lossRateRatio * averageLoser).toFixed(2));

  return {
    netProfit,
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    grossLoss: parseFloat(grossLoss.toFixed(2)),
    profitFactor,
    expectancy,
    averageTrade,
    averageWinner,
    averageLoser,
    largestWinner: parseFloat(largestWinner.toFixed(2)),
    largestLoser: parseFloat(largestLoser.toFixed(2)),
    winCount,
    lossCount,
    breakevenCount,
    totalTrades,
  };
}
