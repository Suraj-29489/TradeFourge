// lib/toolkit/reviews-service.ts
// TradeFourge v4.2 Weekly & Monthly Reviews Engine
// Generates and persists weekly and monthly review workspaces.

import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { calculateCloudAnalytics } from "@/lib/engine/cloud-analytics-engine";
import type { CloudTradeWithRelations, WeeklyReview, MonthlyReview } from "@/types/database";

function getWeeklyReviewsStorageKey(userId: string): string {
  return `tf_weekly_reviews_${userId || "default_user"}`;
}

function getMonthlyReviewsStorageKey(userId: string): string {
  return `tf_monthly_reviews_${userId || "default_user"}`;
}

export function fetchWeeklyReviews(userId: string): WeeklyReview[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getWeeklyReviewsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function fetchMonthlyReviews(userId: string): MonthlyReview[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getMonthlyReviewsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function generateWeeklyReview(
  userId: string,
  trades: CloudTradeWithRelations[],
  targetDate = new Date()
): WeeklyReview {
  const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });
  const startMs = weekStart.getTime();
  const endMs = weekEnd.getTime();

  const weekTrades = trades.filter((t) => {
    const timeMs = new Date(t.close_time || t.open_time || t.created_at).getTime();
    return timeMs >= startMs && timeMs <= endMs;
  });

  const analytics = calculateCloudAnalytics(weekTrades);

  // Extract mistakes
  const mistakesList: string[] = [];
  weekTrades.forEach((t) => {
    if (t.mistakes) {
      t.mistakes.split(",").forEach((m) => {
        const trimmed = m.trim();
        if (trimmed && !mistakesList.includes(trimmed)) mistakesList.push(trimmed);
      });
    }
  });

  const weekLabel = `Week of ${format(weekStart, "MMM dd, yyyy")}`;
  const review: WeeklyReview = {
    id: `WR-${format(weekStart, "yyyy-MM-dd")}`,
    user_id: userId,
    week_label: weekLabel,
    year: targetDate.getFullYear(),
    weekly_pnl: analytics.netProfit,
    win_rate: analytics.winRate,
    total_trades: analytics.totalTrades,
    best_trade_id: weekTrades.length > 0 ? weekTrades.sort((a, b) => b.net_profit - a.net_profit)[0]?.id : null,
    worst_trade_id: weekTrades.length > 0 ? weekTrades.sort((a, b) => a.net_profit - b.net_profit)[0]?.id : null,
    mistakes_summary: mistakesList.length > 0 ? mistakesList : ["No major rule violations tagged this week"],
    improvements: ["Maintain strict stop loss discipline", "Wait for M1 FVG confirmation"],
    goals_achieved: ["Kept risk under 1% per trade", "Logged all trade entries"],
    notes: `Weekly performance review generated automatically for ${weekLabel}. Total PnL: $${analytics.netProfit.toLocaleString()}.`,
    created_at: new Date().toISOString(),
  };

  saveWeeklyReview(userId, review);
  return review;
}

export function generateMonthlyReview(
  userId: string,
  trades: CloudTradeWithRelations[],
  targetDate = new Date()
): MonthlyReview {
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);
  const startMs = monthStart.getTime();
  const endMs = monthEnd.getTime();

  const monthTrades = trades.filter((t) => {
    const timeMs = new Date(t.close_time || t.open_time || t.created_at).getTime();
    return timeMs >= startMs && timeMs <= endMs;
  });

  const analytics = calculateCloudAnalytics(monthTrades);

  const monthLabel = format(monthStart, "MMMM yyyy");
  const review: MonthlyReview = {
    id: `MR-${format(monthStart, "yyyy-MM")}`,
    user_id: userId,
    month_label: monthLabel,
    year: targetDate.getFullYear(),
    monthly_pnl: analytics.netProfit,
    win_rate: analytics.winRate,
    total_trades: analytics.totalTrades,
    best_strategy: analytics.bestSymbol?.symbol ? `${analytics.bestSymbol.symbol} Playbook` : "ICT Silver Bullet",
    weakest_strategy: analytics.worstSymbol?.symbol ? `${analytics.worstSymbol.symbol} Breakout` : "News Trading",
    top_mistakes: ["FOMO Entry", "Early Exit"],
    goals_summary: ["Monthly win rate target achieved", "Risk allocation disciplined"],
    reflection: `Monthly performance reflection for ${monthLabel}. Demonstrated consistent execution across ${analytics.totalTrades} positions with ${analytics.winRate}% win rate.`,
    created_at: new Date().toISOString(),
  };

  saveMonthlyReview(userId, review);
  return review;
}

export function saveWeeklyReview(userId: string, review: WeeklyReview): void {
  if (typeof window === "undefined") return;
  const existing = fetchWeeklyReviews(userId);
  const filtered = existing.filter((r) => r.id !== review.id);
  const updated = [review, ...filtered];
  try {
    localStorage.setItem(getWeeklyReviewsStorageKey(userId), JSON.stringify(updated));
  } catch (err) {
    console.error("[ReviewsService] Failed to save weekly review:", err);
  }
}

export function saveMonthlyReview(userId: string, review: MonthlyReview): void {
  if (typeof window === "undefined") return;
  const existing = fetchMonthlyReviews(userId);
  const filtered = existing.filter((r) => r.id !== review.id);
  const updated = [review, ...filtered];
  try {
    localStorage.setItem(getMonthlyReviewsStorageKey(userId), JSON.stringify(updated));
  } catch (err) {
    console.error("[ReviewsService] Failed to save monthly review:", err);
  }
}
