import {
  NormalizedTrade,
  EngineStats,
  EquityPoint,
  EquityCurveResult,
  DailyPnLPoint,
  WeeklyPnLPoint,
  MonthlyPnLPoint,
  ProfitDistributionPoint,
  DrawdownPoint,
  HourlyPerformancePoint,
  WeekdayPerformancePoint,
} from "./types";
import {
  format,
  parseISO,
  isSameDay,
  isSameWeek,
  isSameMonth,
  compareAsc,
  startOfWeek,
} from "date-fns";

export function formatHoldDuration(totalMs: number | null): string {
  if (!totalMs || totalMs <= 0) return "N/A";
  const seconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);
  if (days > 0)    return `${days}d ${hours % 24}h`;
  if (hours > 0)   return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/* ─── Core Stats ──────────────────────────────────────────────────────────── */

export function calculateEngineStats(trades: NormalizedTrade[], initialBalance = 0): EngineStats {
  if (!trades || trades.length === 0) {
    return {
      netProfit: 0, grossProfit: 0, grossLoss: 0, balance: initialBalance,
      winRate: 0, lossRate: 0, breakevenCount: 0, totalTrades: 0,
      winningTrades: 0, losingTrades: 0, profitFactor: 0, expectancy: 0,
      averageWin: 0, averageLoss: 0, largestWin: 0, largestLoss: 0,
      averageRR: null, averageHoldTime: "N/A",
      currentStreak: { type: "NONE", count: 0 }, bestStreak: 0, worstStreak: 0,
      totalCommission: 0, totalSwap: 0, dailyPnL: 0, weeklyPnL: 0, monthlyPnL: 0,
    };
  }

  const now = new Date();
  const sorted = [...trades].sort((a, b) => compareAsc(parseISO(a.closeTime), parseISO(b.closeTime)));

  let netProfit = 0, grossProfit = 0, grossLoss = 0;
  let winningTrades = 0, losingTrades = 0, breakevenCount = 0;
  let totalCommission = 0, totalSwap = 0;
  let totalRR = 0, validRRCount = 0;
  let totalHoldMs = 0, validHoldCount = 0;
  let largestWin = 0, largestLoss = 0;
  let dailyPnL = 0, weeklyPnL = 0, monthlyPnL = 0;
  let currentStreakType: "WIN" | "LOSS" | "NONE" = "NONE";
  let currentStreakCount = 0, bestStreak = 0, worstStreak = 0;
  let tempWin = 0, tempLoss = 0;

  sorted.forEach((t) => {
    const pnl = t.profit;
    const closeDate = parseISO(t.closeTime);

    netProfit       += pnl;
    totalCommission += t.commission || 0;
    totalSwap       += t.swap       || 0;

    if (t.holdDurationMs && t.holdDurationMs > 0) { totalHoldMs += t.holdDurationMs; validHoldCount++; }
    if (isSameDay(closeDate, now))                   dailyPnL  += pnl;
    if (isSameWeek(closeDate, now, { weekStartsOn: 1 })) weeklyPnL += pnl;
    if (isSameMonth(closeDate, now))                 monthlyPnL += pnl;

    if (pnl > 0.001) {
      winningTrades++; grossProfit += pnl;
      if (pnl > largestWin) largestWin = pnl;
      tempWin++; if (tempWin > bestStreak) bestStreak = tempWin; tempLoss = 0;
      if (currentStreakType === "WIN") currentStreakCount++;
      else { currentStreakType = "WIN"; currentStreakCount = 1; }
    } else if (pnl < -0.001) {
      losingTrades++; const absLoss = Math.abs(pnl); grossLoss += absLoss;
      if (absLoss > largestLoss) largestLoss = absLoss;
      tempLoss++; if (tempLoss > worstStreak) worstStreak = tempLoss; tempWin = 0;
      if (currentStreakType === "LOSS") currentStreakCount++;
      else { currentStreakType = "LOSS"; currentStreakCount = 1; }
    } else {
      breakevenCount++; tempWin = 0; tempLoss = 0;
    }

    if (t.rr !== null && !isNaN(t.rr)) { totalRR += t.rr; validRRCount++; }
  });

  const totalTrades = trades.length;
  const winRate  = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const lossRate = totalTrades > 0 ? (losingTrades  / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? grossProfit : 0;
  const averageWin  = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const averageLoss = losingTrades  > 0 ? grossLoss   / losingTrades  : 0;
  const expectancy  = (winRate / 100) * averageWin - (lossRate / 100) * averageLoss;
  const averageRR   = validRRCount > 0 ? parseFloat((totalRR / validRRCount).toFixed(2)) : null;
  const avgHoldMs   = validHoldCount > 0 ? totalHoldMs / validHoldCount : null;

  return {
    netProfit:       parseFloat(netProfit.toFixed(2)),
    grossProfit:     parseFloat(grossProfit.toFixed(2)),
    grossLoss:       parseFloat(grossLoss.toFixed(2)),
    balance:         parseFloat((initialBalance + netProfit).toFixed(2)),
    winRate:         parseFloat(winRate.toFixed(1)),
    lossRate:        parseFloat(lossRate.toFixed(1)),
    breakevenCount,
    totalTrades,
    winningTrades,
    losingTrades,
    profitFactor:    parseFloat(profitFactor.toFixed(2)),
    expectancy:      parseFloat(expectancy.toFixed(2)),
    averageWin:      parseFloat(averageWin.toFixed(2)),
    averageLoss:     parseFloat(averageLoss.toFixed(2)),
    largestWin:      parseFloat(largestWin.toFixed(2)),
    largestLoss:     parseFloat(largestLoss.toFixed(2)),
    averageRR,
    averageHoldTime: formatHoldDuration(avgHoldMs),
    currentStreak:   { type: currentStreakType, count: currentStreakCount },
    bestStreak,
    worstStreak,
    totalCommission: parseFloat(totalCommission.toFixed(2)),
    totalSwap:       parseFloat(totalSwap.toFixed(2)),
    dailyPnL:        parseFloat(dailyPnL.toFixed(2)),
    weeklyPnL:       parseFloat(weeklyPnL.toFixed(2)),
    monthlyPnL:      parseFloat(monthlyPnL.toFixed(2)),
  };
}

/* ─── Equity Curve ────────────────────────────────────────────────────────── */

export function getEngineEquityCurve(trades: NormalizedTrade[]): EquityCurveResult {
  if (!trades || trades.length === 0) return { points: [], isReconstructed: false };

  const sorted = [...trades].sort((a, b) => compareAsc(parseISO(a.closeTime), parseISO(b.closeTime)));

  // Use real running balance if available in the data
  const hasRealBalance = sorted.some(t => t.balanceAfterTrade != null);

  if (hasRealBalance) {
    const points: EquityPoint[] = [];
    let prevEquity: number | null = null;

    sorted.forEach((t, i) => {
      if (t.balanceAfterTrade != null) {
        // Add starting point from first trade
        if (points.length === 0) {
          const start = t.balanceAfterTrade - t.profit;
          if (start > 0) {
            points.push({
              date: t.openTime ? format(parseISO(t.openTime), "MMM dd") : "Start",
              pnl: 0,
              equity: parseFloat(start.toFixed(2)),
              tradeCount: 0,
              isReconstructed: false,
            });
          }
        }
        prevEquity = t.balanceAfterTrade;
      }

      const equity = prevEquity ?? 0;
      points.push({
        date: format(parseISO(t.closeTime), "MMM dd HH:mm"),
        pnl: parseFloat(t.profit.toFixed(2)),
        equity: parseFloat(equity.toFixed(2)),
        tradeCount: i + 1,
        isReconstructed: false,
      });
    });

    return { points, isReconstructed: false };
  }

  // No real balance — reconstruct from cumulative PnL starting at 0
  let cumulative = 0;
  const points: EquityPoint[] = [{
    date: sorted[0].openTime ? format(parseISO(sorted[0].openTime), "MMM dd") : "Start",
    pnl: 0,
    equity: 0,
    tradeCount: 0,
    isReconstructed: true,
  }];

  sorted.forEach((t, i) => {
    cumulative += t.profit;
    points.push({
      date: format(parseISO(t.closeTime), "MMM dd HH:mm"),
      pnl: parseFloat(t.profit.toFixed(2)),
      equity: parseFloat(cumulative.toFixed(2)),
      tradeCount: i + 1,
      isReconstructed: true,
    });
  });

  return { points, isReconstructed: true };
}

/* ─── Daily PnL ───────────────────────────────────────────────────────────── */

export function getEngineDailyPnLSeries(trades: NormalizedTrade[]): DailyPnLPoint[] {
  if (!trades || trades.length === 0) return [];
  const map = new Map<string, { pnl: number; count: number; wins: number }>();

  trades.forEach(t => {
    const key = format(parseISO(t.closeTime), "yyyy-MM-dd");
    const ex  = map.get(key) || { pnl: 0, count: 0, wins: 0 };
    ex.pnl += t.profit; ex.count++; if (t.profit > 0) ex.wins++;
    map.set(key, ex);
  });

  return Array.from(map.keys()).sort().map(key => {
    const { pnl, count, wins } = map.get(key)!;
    return {
      date: format(parseISO(key), "MMM dd"),
      pnl: parseFloat(pnl.toFixed(2)),
      trades: count,
      winRate: parseFloat(((wins / count) * 100).toFixed(0)),
    };
  });
}

/* ─── Weekly PnL ──────────────────────────────────────────────────────────── */

export function getEngineWeeklyPnLSeries(trades: NormalizedTrade[]): WeeklyPnLPoint[] {
  if (!trades || trades.length === 0) return [];
  const map = new Map<string, { pnl: number; trades: number }>();

  trades.forEach(t => {
    const weekStart = startOfWeek(parseISO(t.closeTime), { weekStartsOn: 1 });
    const key = format(weekStart, "yyyy-MM-dd");
    const ex  = map.get(key) || { pnl: 0, trades: 0 };
    ex.pnl += t.profit; ex.trades++;
    map.set(key, ex);
  });

  return Array.from(map.keys()).sort().map(key => {
    const { pnl, trades: count } = map.get(key)!;
    return {
      week: format(parseISO(key), "MMM dd"),
      pnl: parseFloat(pnl.toFixed(2)),
      trades: count,
    };
  });
}

/* ─── Monthly PnL ─────────────────────────────────────────────────────────── */

export function getEngineMonthlyPnLSeries(trades: NormalizedTrade[]): MonthlyPnLPoint[] {
  if (!trades || trades.length === 0) return [];
  const map = new Map<string, { pnl: number; trades: number }>();

  trades.forEach(t => {
    const key = format(parseISO(t.closeTime), "yyyy-MM");
    const ex  = map.get(key) || { pnl: 0, trades: 0 };
    ex.pnl += t.profit; ex.trades++;
    map.set(key, ex);
  });

  return Array.from(map.keys()).sort().map(key => ({
    month: format(parseISO(`${key}-01`), "MMM yyyy"),
    pnl: parseFloat(map.get(key)!.pnl.toFixed(2)),
    trades: map.get(key)!.trades,
  }));
}

/* ─── Drawdown ────────────────────────────────────────────────────────────── */

export function getEngineDrawdownSeries(trades: NormalizedTrade[]): DrawdownPoint[] {
  if (!trades || trades.length === 0) return [];
  const sorted = [...trades].sort((a, b) => compareAsc(parseISO(a.closeTime), parseISO(b.closeTime)));

  let peak = 0, current = 0;

  return sorted.map(t => {
    current += t.profit;
    if (current > peak) peak = current;
    const drawdown = current - peak;
    const drawdownPercent = peak !== 0 ? (drawdown / Math.abs(peak)) * 100 : 0;
    return {
      date: format(parseISO(t.closeTime), "MMM dd"),
      drawdown: parseFloat(drawdown.toFixed(2)),
      drawdownPercent: parseFloat(drawdownPercent.toFixed(2)),
    };
  });
}

/* ─── Profit Distribution ─────────────────────────────────────────────────── */

export function getEngineProfitDistribution(trades: NormalizedTrade[]): ProfitDistributionPoint[] {
  if (!trades || trades.length === 0) return [];
  const ranges = [
    { label: "< -$1k",       min: -Infinity, max: -1000, count: 0 },
    { label: "-$1k to -$500", min: -1000,   max: -500,  count: 0 },
    { label: "-$500 to $0",   min: -500,    max: 0,     count: 0 },
    { label: "$0 to $500",    min: 0,       max: 500,   count: 0 },
    { label: "$500 to $1.5k", min: 500,     max: 1500,  count: 0 },
    { label: "> $1.5k",       min: 1500,    max: Infinity, count: 0 },
  ];

  trades.forEach(t => {
    const r = ranges.find(rg => t.profit >= rg.min && t.profit < rg.max);
    if (r) r.count++;
  });

  return ranges.map(r => ({ range: r.label, count: r.count }));
}

/* ─── Symbol Performance ──────────────────────────────────────────────────── */

export function getEngineSymbolPerformance(trades: NormalizedTrade[]) {
  if (!trades || trades.length === 0) return [];
  const map = new Map<string, { symbol: string; trades: number; pnl: number; wins: number; losses: number }>();

  trades.forEach(t => {
    const ex = map.get(t.symbol) || { symbol: t.symbol, trades: 0, pnl: 0, wins: 0, losses: 0 };
    ex.trades++; ex.pnl += t.profit;
    if (t.profit > 0) ex.wins++; else if (t.profit < 0) ex.losses++;
    map.set(t.symbol, ex);
  });

  return Array.from(map.values()).map(s => ({
    ...s,
    winRate: parseFloat(((s.wins / s.trades) * 100).toFixed(1)),
    pnl: parseFloat(s.pnl.toFixed(2)),
  }));
}

/* ─── Hourly Performance ──────────────────────────────────────────────────── */

export function getEngineHourlyPerformance(trades: NormalizedTrade[]): HourlyPerformancePoint[] {
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    pnl: 0, trades: 0, wins: 0,
  }));

  trades.forEach(t => {
    const h = parseISO(t.closeTime).getHours();
    hours[h].pnl += t.profit; hours[h].trades++;
    if (t.profit > 0) hours[h].wins++;
  });

  return hours.map(h => ({
    hour: h.hour,
    pnl: parseFloat(h.pnl.toFixed(2)),
    trades: h.trades,
    winRate: h.trades > 0 ? parseFloat(((h.wins / h.trades) * 100).toFixed(1)) : 0,
  }));
}

/* ─── Weekday Performance ─────────────────────────────────────────────────── */

export function getEngineWeekdayPerformance(trades: NormalizedTrade[]): WeekdayPerformancePoint[] {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days = DAYS.map(d => ({ day: d, pnl: 0, trades: 0, wins: 0 }));

  trades.forEach(t => {
    const dow = parseISO(t.closeTime).getDay(); // 0=Sun
    const idx = dow === 0 ? 6 : dow - 1;        // Convert to Mon=0
    days[idx].pnl += t.profit; days[idx].trades++;
    if (t.profit > 0) days[idx].wins++;
  });

  return days.map(d => ({
    day: d.day,
    pnl: parseFloat(d.pnl.toFixed(2)),
    trades: d.trades,
    winRate: d.trades > 0 ? parseFloat(((d.wins / d.trades) * 100).toFixed(1)) : 0,
  }));
}
