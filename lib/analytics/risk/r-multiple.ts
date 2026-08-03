// lib/analytics/risk/r-multiple.ts
// Phase 4 — Pure R-Multiple Distribution Engine

import { TradeInput, RMultipleBucket } from "../types";

/**
 * Categorizes trades into R-multiple risk distribution buckets (< -2R, -2R to -1R, -1R to 0R, 0R to 1R, 1R to 2R, > 2R).
 * Pure function: Input TradeInput[] -> Output RMultipleBucket[]
 */
export function calculateRMultipleDistribution(trades: TradeInput[]): RMultipleBucket[] {
  const BUCKET_LABELS = ["< -2R", "-2R to -1R", "-1R to 0R", "0R to 1R", "1R to 2R", "> 2R"];
  const counts = [0, 0, 0, 0, 0, 0];

  if (!trades || trades.length === 0) {
    return BUCKET_LABELS.map((label) => ({ bucketLabel: label, count: 0, percentage: 0 }));
  }

  trades.forEach((t) => {
    let r = t.rr;

    // If RR is not explicitly provided, estimate from profit vs risk
    if (r === undefined || r === null) {
      const pnl = (t.profit || 0) - Math.abs(t.commission || 0) + (t.swap || 0);
      r = pnl > 0 ? 1.5 : pnl < 0 ? -1.0 : 0;
    }

    if (r < -2.0) counts[0]++;
    else if (r >= -2.0 && r < -1.0) counts[1]++;
    else if (r >= -1.0 && r < 0) counts[2]++;
    else if (r >= 0 && r < 1.0) counts[3]++;
    else if (r >= 1.0 && r <= 2.0) counts[4]++;
    else counts[5]++;
  });

  const total = trades.length;
  return BUCKET_LABELS.map((label, idx) => ({
    bucketLabel: label,
    count: counts[idx],
    percentage: total > 0 ? parseFloat(((counts[idx] / total) * 100).toFixed(1)) : 0,
  }));
}
