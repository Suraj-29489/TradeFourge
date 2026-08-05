// lib/toolkit/mistakes-engine.ts
// TradeFourge v4.2 Mistake Analytics & Discipline Engine
// Analyzes mistake tags across trades, computes frequency, win rate impact, and common violations.

import type { CloudTradeWithRelations, CommonMistakeType } from "@/types/database";

export interface MistakeSummary {
  name: CommonMistakeType | string;
  count: number;
  percentage: number;
  pnlImpact: number;
  winRate: number;
}

export const COMMON_MISTAKES: CommonMistakeType[] = [
  "FOMO",
  "Revenge Trading",
  "Early Exit",
  "Late Entry",
  "Over Risk",
  "News Trade",
  "Rule Violation",
];

export function analyzeTradeMistakes(trades: CloudTradeWithRelations[]): {
  summaries: MistakeSummary[];
  totalMistakesTagged: number;
  disciplineScore: number;
} {
  const mistakeCounts: Record<string, { count: number; pnl: number; wins: number }> = {};
  let totalMistakesTagged = 0;

  trades.forEach((trade) => {
    if (!trade.mistakes) return;
    const items = trade.mistakes.split(",").map((s) => s.trim()).filter(Boolean);

    items.forEach((mKey) => {
      totalMistakesTagged++;
      if (!mistakeCounts[mKey]) {
        mistakeCounts[mKey] = { count: 0, pnl: 0, wins: 0 };
      }
      mistakeCounts[mKey].count += 1;
      mistakeCounts[mKey].pnl += trade.net_profit;
      if (trade.outcome === "WIN") mistakeCounts[mKey].wins += 1;
    });
  });

  const summaries: MistakeSummary[] = Object.entries(mistakeCounts)
    .map(([name, data]) => ({
      name,
      count: data.count,
      percentage: totalMistakesTagged > 0 ? parseFloat(((data.count / totalMistakesTagged) * 100).toFixed(1)) : 0,
      pnlImpact: data.pnl,
      winRate: data.count > 0 ? parseFloat(((data.wins / data.count) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Compute Discipline Score (100 - (mistake trades / total trades * 100))
  const cleanTrades = trades.filter((t) => !t.mistakes || t.mistakes.trim().length === 0).length;
  const disciplineScore = trades.length > 0 ? Math.round((cleanTrades / trades.length) * 100) : 100;

  return {
    summaries,
    totalMistakesTagged,
    disciplineScore,
  };
}
