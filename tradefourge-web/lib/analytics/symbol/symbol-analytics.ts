// lib/analytics/symbol/symbol-analytics.ts
// Phase 6 — Pure Symbol Analytics Engine (Trade Count, Lot Volume, Profit, Win Rate, Best/Worst Symbol)

import { TradeInput, SymbolAnalyticsMetrics, SymbolAnalyticsItem } from "../types";

/**
 * Calculates per-symbol analytics metrics, identify best/worst symbols, and total volume.
 * Pure function: Input TradeInput[] -> Output SymbolAnalyticsMetrics
 */
export function calculateSymbolAnalytics(trades: TradeInput[]): SymbolAnalyticsMetrics {
  if (!trades || trades.length === 0) {
    return {
      symbols: {},
      bestSymbol: null,
      worstSymbol: null,
      totalVolume: 0,
    };
  }

  const symbolMap: Record<string, { tradeCount: number; totalVolume: number; netProfit: number; winCount: number }> = {};
  let totalVolumeAll = 0;

  trades.forEach((t) => {
    const sym = (t.symbol || "UNKNOWN").toUpperCase();
    const volume = Math.abs(t.volume || 0.01);
    const netPnL = (t.profit || 0) - Math.abs(t.commission || 0) + (t.swap || 0);
    const isWin = netPnL > 0.001;

    totalVolumeAll += volume;

    if (!symbolMap[sym]) {
      symbolMap[sym] = { tradeCount: 0, totalVolume: 0, netProfit: 0, winCount: 0 };
    }

    symbolMap[sym].tradeCount++;
    symbolMap[sym].totalVolume += volume;
    symbolMap[sym].netProfit += netPnL;
    if (isWin) symbolMap[sym].winCount++;
  });

  const symbols: Record<string, SymbolAnalyticsItem> = {};
  let bestSymbol: SymbolAnalyticsItem | null = null;
  let worstSymbol: SymbolAnalyticsItem | null = null;

  let maxProfit = -Infinity;
  let minProfit = Infinity;

  Object.keys(symbolMap).forEach((sym) => {
    const data = symbolMap[sym];
    const winRate = data.tradeCount > 0 ? parseFloat(((data.winCount / data.tradeCount) * 100).toFixed(1)) : 0;
    const averageProfit = data.tradeCount > 0 ? parseFloat((data.netProfit / data.tradeCount).toFixed(2)) : 0;
    const netProfit = parseFloat(data.netProfit.toFixed(2));
    const totalVolume = parseFloat(data.totalVolume.toFixed(2));

    const item: SymbolAnalyticsItem = {
      symbol: sym,
      tradeCount: data.tradeCount,
      totalVolume,
      netProfit,
      winRate,
      averageProfit,
    };

    symbols[sym] = item;

    if (netProfit > maxProfit) {
      maxProfit = netProfit;
      bestSymbol = item;
    }
    if (netProfit < minProfit) {
      minProfit = netProfit;
      worstSymbol = item;
    }
  });

  return {
    symbols,
    bestSymbol,
    worstSymbol,
    totalVolume: parseFloat(totalVolumeAll.toFixed(2)),
  };
}
