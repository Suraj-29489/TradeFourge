// lib/analytics/time/time-analytics.ts
// Phase 5 — Pure Time Analytics Engine (Holding Time, Trading Sessions, Best Trading Hour, Best Weekday)

import { TradeInput, TimeAnalyticsMetrics, SessionMetrics } from "../types";
import { parseISO, getHours, getDay } from "date-fns";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Calculates holding duration stats, session win rates, best trading hour, and best weekday.
 * Pure function: Input TradeInput[] -> Output TimeAnalyticsMetrics
 */
export function calculateTimeAnalytics(trades: TradeInput[]): TimeAnalyticsMetrics {
  if (!trades || trades.length === 0) {
    return {
      averageHoldDurationSeconds: 0,
      medianHoldDurationSeconds: 0,
      minHoldDurationSeconds: 0,
      maxHoldDurationSeconds: 0,
      sessions: [
        { session: "Asian", totalTrades: 0, winRate: 0, netProfit: 0 },
        { session: "London", totalTrades: 0, winRate: 0, netProfit: 0 },
        { session: "New York", totalTrades: 0, winRate: 0, netProfit: 0 },
        { session: "Overlap", totalTrades: 0, winRate: 0, netProfit: 0 },
      ],
      bestTradingHour: { hour: 0, netProfit: 0, winRate: 0 },
      bestWeekday: { day: "Monday", netProfit: 0, winRate: 0 },
    };
  }

  const durations: number[] = [];
  const sessionStats: Record<string, { totalTrades: number; winCount: number; netProfit: number }> = {
    Asian: { totalTrades: 0, winCount: 0, netProfit: 0 },
    London: { totalTrades: 0, winCount: 0, netProfit: 0 },
    "New York": { totalTrades: 0, winCount: 0, netProfit: 0 },
    Overlap: { totalTrades: 0, winCount: 0, netProfit: 0 },
  };

  const hourStats: Record<number, { totalTrades: number; winCount: number; netProfit: number }> = {};
  const dayStats: Record<string, { totalTrades: number; winCount: number; netProfit: number }> = {};

  for (let h = 0; h < 24; h++) hourStats[h] = { totalTrades: 0, winCount: 0, netProfit: 0 };
  WEEKDAYS.forEach((d) => (dayStats[d] = { totalTrades: 0, winCount: 0, netProfit: 0 }));

  trades.forEach((t) => {
    const netPnL = (t.profit || 0) - Math.abs(t.commission || 0) + (t.swap || 0);
    const isWin = netPnL > 0.001;

    // 1. Holding Time Duration
    if (t.openTime && t.closeTime) {
      const openD = parseISO(t.openTime);
      const closeD = parseISO(t.closeTime);
      if (!isNaN(openD.getTime()) && !isNaN(closeD.getTime())) {
        const diffSec = Math.max(0, Math.round((closeD.getTime() - openD.getTime()) / 1000));
        durations.push(diffSec);
      }
    }

    // 2. Session & Hour Analysis
    const dateIso = t.openTime || t.closeTime;
    if (dateIso) {
      const d = parseISO(dateIso);
      if (!isNaN(d.getTime())) {
        const hour = getHours(d); // 0-23 UTC
        const weekday = WEEKDAYS[getDay(d)];

        // Hour stats
        hourStats[hour].totalTrades++;
        hourStats[hour].netProfit += netPnL;
        if (isWin) hourStats[hour].winCount++;

        // Weekday stats
        dayStats[weekday].totalTrades++;
        dayStats[weekday].netProfit += netPnL;
        if (isWin) dayStats[weekday].winCount++;

        // Session classification (UTC hours)
        // Asian: 00:00 - 08:00 UTC
        // London: 08:00 - 13:00 UTC
        // Overlap (London/NY): 13:00 - 17:00 UTC
        // New York: 17:00 - 22:00 UTC
        let targetSession = "Asian";
        if (hour >= 0 && hour < 8) targetSession = "Asian";
        else if (hour >= 8 && hour < 13) targetSession = "London";
        else if (hour >= 13 && hour < 17) targetSession = "Overlap";
        else targetSession = "New York";

        sessionStats[targetSession].totalTrades++;
        sessionStats[targetSession].netProfit += netPnL;
        if (isWin) sessionStats[targetSession].winCount++;
      }
    }
  });

  // Hold duration statistics
  durations.sort((a, b) => a - b);
  const avgHold = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const medianHold = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;
  const minHold = durations.length > 0 ? durations[0] : 0;
  const maxHold = durations.length > 0 ? durations[durations.length - 1] : 0;

  // Session Metrics Output
  const sessions: SessionMetrics[] = Object.keys(sessionStats).map((name) => {
    const s = sessionStats[name];
    const winRate = s.totalTrades > 0 ? parseFloat(((s.winCount / s.totalTrades) * 100).toFixed(1)) : 0;
    return {
      session: name as any,
      totalTrades: s.totalTrades,
      winRate,
      netProfit: parseFloat(s.netProfit.toFixed(2)),
    };
  });

  // Find Best Hour
  let bestHour = 0;
  let maxHourProfit = -Infinity;
  Object.keys(hourStats).forEach((hStr) => {
    const h = parseInt(hStr, 10);
    if (hourStats[h].netProfit > maxHourProfit && hourStats[h].totalTrades > 0) {
      maxHourProfit = hourStats[h].netProfit;
      bestHour = h;
    }
  });

  const bestHourStats = hourStats[bestHour];
  const bestTradingHour = {
    hour: bestHour,
    netProfit: parseFloat((bestHourStats?.netProfit || 0).toFixed(2)),
    winRate: bestHourStats && bestHourStats.totalTrades > 0 ? parseFloat(((bestHourStats.winCount / bestHourStats.totalTrades) * 100).toFixed(1)) : 0,
  };

  // Find Best Weekday
  let bestDay = "Monday";
  let maxDayProfit = -Infinity;
  WEEKDAYS.forEach((d) => {
    if (dayStats[d].netProfit > maxDayProfit && dayStats[d].totalTrades > 0) {
      maxDayProfit = dayStats[d].netProfit;
      bestDay = d;
    }
  });

  const bestDayStats = dayStats[bestDay];
  const bestWeekday = {
    day: bestDay,
    netProfit: parseFloat((bestDayStats?.netProfit || 0).toFixed(2)),
    winRate: bestDayStats && bestDayStats.totalTrades > 0 ? parseFloat(((bestDayStats.winCount / bestDayStats.totalTrades) * 100).toFixed(1)) : 0,
  };

  return {
    averageHoldDurationSeconds: avgHold,
    medianHoldDurationSeconds: medianHold,
    minHoldDurationSeconds: minHold,
    maxHoldDurationSeconds: maxHold,
    sessions,
    bestTradingHour,
    bestWeekday,
  };
}
