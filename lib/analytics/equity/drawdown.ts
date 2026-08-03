// lib/analytics/equity/drawdown.ts
// Phase 1 & 4 — Pure Drawdown Calculation Engine

import { EquityPoint, DrawdownMetrics } from "../types";

/**
 * Computes peak-to-trough max drawdown amount, max drawdown percentage, and drawdown curve.
 * Pure function: Input EquityPoint[] -> Output DrawdownMetrics
 */
export function calculateDrawdownMetrics(equityPoints: EquityPoint[]): DrawdownMetrics {
  if (!equityPoints || equityPoints.length === 0) {
    return {
      maxDrawdownAmount: 0,
      maxDrawdownPercent: 0,
      relativeDrawdownPercent: 0,
      drawdownCurve: [],
    };
  }

  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;

  const drawdownCurve = equityPoints.map((pt) => {
    if (pt.drawdown > maxDrawdownAmount) {
      maxDrawdownAmount = pt.drawdown;
    }
    if (pt.drawdownPercent > maxDrawdownPercent) {
      maxDrawdownPercent = pt.drawdownPercent;
    }

    return {
      timestamp: pt.timestamp,
      drawdown: pt.drawdown,
      drawdownPercent: pt.drawdownPercent,
    };
  });

  return {
    maxDrawdownAmount: parseFloat(maxDrawdownAmount.toFixed(2)),
    maxDrawdownPercent: parseFloat(maxDrawdownPercent.toFixed(2)),
    relativeDrawdownPercent: parseFloat(maxDrawdownPercent.toFixed(2)),
    drawdownCurve,
  };
}
