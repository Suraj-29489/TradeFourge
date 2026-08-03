// lib/analytics/equity/equity-curve.ts
// Phase 1 — Pure Equity Curve & Running Balance Calculations

import { TradeInput, EquityPoint } from "../types";

/**
 * Calculates time-series equity points, balance points, running peak equity, and drawdown.
 * Pure function: Input TradeInput[] -> Output EquityPoint[]
 */
export function calculateEquityAndBalanceCurve(
  trades: TradeInput[],
  initialBalance = 10000
): EquityPoint[] {
  if (!trades || trades.length === 0) {
    return [
      {
        timestamp: new Date().toISOString(),
        tradeIndex: 0,
        profit: 0,
        balance: initialBalance,
        equity: initialBalance,
        peakEquity: initialBalance,
        drawdown: 0,
        drawdownPercent: 0,
      },
    ];
  }

  // Sort trades chronologically by closeTime or openTime
  const sortedTrades = [...trades].sort((a, b) => {
    const timeA = new Date(a.closeTime || a.openTime || 0).getTime();
    const timeB = new Date(b.closeTime || b.openTime || 0).getTime();
    return timeA - timeB;
  });

  const points: EquityPoint[] = [];
  let currentBalance = initialBalance;
  let peakEquity = initialBalance;

  // Add initial starting point
  const firstTime = sortedTrades[0].openTime || sortedTrades[0].closeTime || new Date().toISOString();
  points.push({
    timestamp: firstTime,
    tradeIndex: 0,
    profit: 0,
    balance: initialBalance,
    equity: initialBalance,
    peakEquity: initialBalance,
    drawdown: 0,
    drawdownPercent: 0,
  });

  sortedTrades.forEach((trade, idx) => {
    const profit = trade.profit || 0;
    const comm = trade.commission || 0;
    const swap = trade.swap || 0;
    const netTradeProfit = profit - Math.abs(comm) + swap;

    currentBalance = parseFloat((currentBalance + netTradeProfit).toFixed(2));
    if (currentBalance > peakEquity) {
      peakEquity = currentBalance;
    }

    const drawdown = parseFloat(Math.max(0, peakEquity - currentBalance).toFixed(2));
    const drawdownPercent = peakEquity > 0 ? parseFloat(((drawdown / peakEquity) * 100).toFixed(2)) : 0;
    const timestamp = trade.closeTime || trade.openTime || new Date().toISOString();

    points.push({
      timestamp,
      tradeIndex: idx + 1,
      profit: parseFloat(netTradeProfit.toFixed(2)),
      balance: currentBalance,
      equity: currentBalance,
      peakEquity,
      drawdown,
      drawdownPercent,
    });
  });

  return points;
}
