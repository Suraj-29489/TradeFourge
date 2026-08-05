// lib/analytics/time/returns.ts
// Phase 5 — Pure Returns Analytics Engine (Monthly Returns & Daily Returns)

import { TradeInput, ReturnsMetrics } from "../types";
import { parseISO, format } from "date-fns";

/**
 * Aggregates daily and monthly net profit & return percentages.
 * Pure function: Input (trades, initialBalance) -> Output ReturnsMetrics
 */
export function calculateReturns(trades: TradeInput[], initialBalance = 10000): ReturnsMetrics {
  if (!trades || trades.length === 0) {
    return {
      monthlyReturns: [],
      dailyReturns: [],
    };
  }

  const dailyMap: Record<string, { netProfit: number; tradeCount: number }> = {};
  const monthlyMap: Record<string, { year: number; month: number; netProfit: number }> = {};

  trades.forEach((t) => {
    const netPnL = (t.profit || 0) - Math.abs(t.commission || 0) + (t.swap || 0);
    const dateIso = t.closeTime || t.openTime;

    if (dateIso) {
      const d = parseISO(dateIso);
      if (!isNaN(d.getTime())) {
        // Daily
        const dayKey = format(d, "yyyy-MM-dd");
        if (!dailyMap[dayKey]) dailyMap[dayKey] = { netProfit: 0, tradeCount: 0 };
        dailyMap[dayKey].netProfit += netPnL;
        dailyMap[dayKey].tradeCount++;

        // Monthly
        const monthKey = format(d, "yyyy-MM");
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            netProfit: 0,
          };
        }
        monthlyMap[monthKey].netProfit += netPnL;
      }
    }
  });

  // Convert daily map to sorted array
  const dailyReturns = Object.keys(dailyMap)
    .sort()
    .map((date) => ({
      date,
      netProfit: parseFloat(dailyMap[date].netProfit.toFixed(2)),
      tradeCount: dailyMap[date].tradeCount,
    }));

  // Convert monthly map to sorted array
  const monthlyReturns = Object.keys(monthlyMap)
    .sort()
    .map((monthYear) => {
      const item = monthlyMap[monthYear];
      const percentageReturn = initialBalance > 0 ? parseFloat(((item.netProfit / initialBalance) * 100).toFixed(2)) : 0;
      return {
        monthYear,
        year: item.year,
        month: item.month,
        netProfit: parseFloat(item.netProfit.toFixed(2)),
        percentageReturn,
      };
    });

  return {
    monthlyReturns,
    dailyReturns,
  };
}
