// lib/analytics/performance/win-loss.ts
// Phase 3 — Pure Win/Loss Analytics (Overall, By Symbol, By Day, By Week, By Month, Long vs Short, Buy vs Sell)

import { TradeInput, WinLossMetrics, CategoryBreakdown } from "../types";
import { format, parseISO } from "date-fns";

function createCategoryBreakdown(category: string): CategoryBreakdown {
  return {
    category,
    totalTrades: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    netProfit: 0,
  };
}

function finalizeCategoryBreakdown(item: CategoryBreakdown): CategoryBreakdown {
  const winRate = item.totalTrades > 0 ? parseFloat(((item.winCount / item.totalTrades) * 100).toFixed(1)) : 0;
  return {
    ...item,
    winRate,
    netProfit: parseFloat(item.netProfit.toFixed(2)),
  };
}

/**
 * Calculates win rate breakdowns by symbol, day, week, month, and direction.
 * Pure function: Input TradeInput[] -> Output WinLossMetrics
 */
export function calculateWinLossBreakdowns(trades: TradeInput[]): WinLossMetrics {
  if (!trades || trades.length === 0) {
    return {
      overallWinRate: 0,
      bySymbol: {},
      byDay: {},
      byWeek: {},
      byMonth: {},
      longVsShort: {
        long: createCategoryBreakdown("LONG"),
        short: createCategoryBreakdown("SHORT"),
      },
      buyVsSell: {
        buy: createCategoryBreakdown("BUY"),
        sell: createCategoryBreakdown("SELL"),
      },
    };
  }

  let totalWins = 0;
  const bySymbolMap: Record<string, CategoryBreakdown> = {};
  const byDayMap: Record<string, CategoryBreakdown> = {};
  const byWeekMap: Record<string, CategoryBreakdown> = {};
  const byMonthMap: Record<string, CategoryBreakdown> = {};

  const longBreakdown = createCategoryBreakdown("LONG");
  const shortBreakdown = createCategoryBreakdown("SHORT");
  const buyBreakdown = createCategoryBreakdown("BUY");
  const sellBreakdown = createCategoryBreakdown("SELL");

  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  trades.forEach((t) => {
    const pnl = (t.profit || 0) - Math.abs(t.commission || 0) + (t.swap || 0);
    const isWin = pnl > 0.001;
    const isLoss = pnl < -0.001;
    if (isWin) totalWins++;

    // 1. Symbol Breakdown
    const sym = t.symbol.toUpperCase();
    if (!bySymbolMap[sym]) bySymbolMap[sym] = createCategoryBreakdown(sym);
    bySymbolMap[sym].totalTrades++;
    bySymbolMap[sym].netProfit += pnl;
    if (isWin) bySymbolMap[sym].winCount++;
    if (isLoss) bySymbolMap[sym].lossCount++;

    // 2. Date parsing for Day, Week, Month
    const dateIso = t.closeTime || t.openTime;
    if (dateIso) {
      const d = parseISO(dateIso);
      if (!isNaN(d.getTime())) {
        const dayName = WEEKDAYS[d.getDay()];
        if (!byDayMap[dayName]) byDayMap[dayName] = createCategoryBreakdown(dayName);
        byDayMap[dayName].totalTrades++;
        byDayMap[dayName].netProfit += pnl;
        if (isWin) byDayMap[dayName].winCount++;
        if (isLoss) byDayMap[dayName].lossCount++;

        const weekKey = `Week ${format(d, "w, yyyy")}`;
        if (!byWeekMap[weekKey]) byWeekMap[weekKey] = createCategoryBreakdown(weekKey);
        byWeekMap[weekKey].totalTrades++;
        byWeekMap[weekKey].netProfit += pnl;
        if (isWin) byWeekMap[weekKey].winCount++;
        if (isLoss) byWeekMap[weekKey].lossCount++;

        const monthKey = format(d, "MMM yyyy");
        if (!byMonthMap[monthKey]) byMonthMap[monthKey] = createCategoryBreakdown(monthKey);
        byMonthMap[monthKey].totalTrades++;
        byMonthMap[monthKey].netProfit += pnl;
        if (isWin) byMonthMap[monthKey].winCount++;
        if (isLoss) byMonthMap[monthKey].lossCount++;
      }
    }

    // 3. Directional Breakdown
    const sideClean = (t.side || "BUY").toUpperCase();
    const isLong = sideClean === "BUY" || sideClean === "LONG";

    if (isLong) {
      longBreakdown.totalTrades++;
      longBreakdown.netProfit += pnl;
      if (isWin) longBreakdown.winCount++;
      if (isLoss) longBreakdown.lossCount++;

      buyBreakdown.totalTrades++;
      buyBreakdown.netProfit += pnl;
      if (isWin) buyBreakdown.winCount++;
      if (isLoss) buyBreakdown.lossCount++;
    } else {
      shortBreakdown.totalTrades++;
      shortBreakdown.netProfit += pnl;
      if (isWin) shortBreakdown.winCount++;
      if (isLoss) shortBreakdown.lossCount++;

      sellBreakdown.totalTrades++;
      sellBreakdown.netProfit += pnl;
      if (isWin) sellBreakdown.winCount++;
      if (isLoss) sellBreakdown.lossCount++;
    }
  });

  const overallWinRate = parseFloat(((totalWins / trades.length) * 100).toFixed(1));

  // Finalize maps
  const bySymbol: Record<string, CategoryBreakdown> = {};
  Object.keys(bySymbolMap).forEach((k) => (bySymbol[k] = finalizeCategoryBreakdown(bySymbolMap[k])));

  const byDay: Record<string, CategoryBreakdown> = {};
  Object.keys(byDayMap).forEach((k) => (byDay[k] = finalizeCategoryBreakdown(byDayMap[k])));

  const byWeek: Record<string, CategoryBreakdown> = {};
  Object.keys(byWeekMap).forEach((k) => (byWeek[k] = finalizeCategoryBreakdown(byWeekMap[k])));

  const byMonth: Record<string, CategoryBreakdown> = {};
  Object.keys(byMonthMap).forEach((k) => (byMonth[k] = finalizeCategoryBreakdown(byMonthMap[k])));

  return {
    overallWinRate,
    bySymbol,
    byDay,
    byWeek,
    byMonth,
    longVsShort: {
      long: finalizeCategoryBreakdown(longBreakdown),
      short: finalizeCategoryBreakdown(shortBreakdown),
    },
    buyVsSell: {
      buy: finalizeCategoryBreakdown(buyBreakdown),
      sell: finalizeCategoryBreakdown(sellBreakdown),
    },
  };
}
