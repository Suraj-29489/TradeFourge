import {
  NormalizedTrade,
  EngineStats,
  EquityPoint,
  DailyPnLPoint,
  MonthlyPnLPoint,
  ProfitDistributionPoint,
  DrawdownPoint,
} from "./types";
import { format, parseISO, isSameDay, isSameWeek, isSameMonth, compareAsc } from "date-fns";

export function formatHoldDuration(totalMs: number | null): string {
  if (!totalMs || totalMs <= 0) return "N/A";
  const seconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function calculateEngineStats(trades: NormalizedTrade[], initialBalance = 10000): EngineStats {
  if (!trades || trades.length === 0) {
    return {
      netProfit: 0,
      grossProfit: 0,
      grossLoss: 0,
      balance: initialBalance,
      winRate: 0,
      lossRate: 0,
      breakevenCount: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      profitFactor: 0,
      expectancy: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      averageRR: null,
      averageHoldTime: "N/A",
      currentStreak: { type: "NONE", count: 0 },
      bestStreak: 0,
      worstStreak: 0,
      totalCommission: 0,
      totalSwap: 0,
      dailyPnL: 0,
      weeklyPnL: 0,
      monthlyPnL: 0,
    };
  }

  const now = new Date();
  const sorted = [...trades].sort((a, b) =>
    compareAsc(parseISO(a.closeTime), parseISO(b.closeTime))
  );

  let netProfit = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let breakevenCount = 0;
  let totalCommission = 0;
  let totalSwap = 0;

  let totalRR = 0;
  let validRRCount = 0;
  let totalHoldMs = 0;
  let validHoldCount = 0;

  let largestWin = 0;
  let largestLoss = 0;

  let dailyPnL = 0;
  let weeklyPnL = 0;
  let monthlyPnL = 0;

  let currentStreakType: "WIN" | "LOSS" | "NONE" = "NONE";
  let currentStreakCount = 0;
  let bestStreak = 0;
  let worstStreak = 0;

  let tempWin = 0;
  let tempLoss = 0;

  sorted.forEach((t) => {
    const pnl = t.profit;
    const closeDate = parseISO(t.closeTime);

    netProfit += pnl;
    totalCommission += t.commission || 0;
    totalSwap += t.swap || 0;

    if (t.holdDurationMs && t.holdDurationMs > 0) {
      totalHoldMs += t.holdDurationMs;
      validHoldCount++;
    }

    if (isSameDay(closeDate, now)) dailyPnL += pnl;
    if (isSameWeek(closeDate, now, { weekStartsOn: 1 })) weeklyPnL += pnl;
    if (isSameMonth(closeDate, now)) monthlyPnL += pnl;

    if (pnl > 0.01) {
      winningTrades++;
      grossProfit += pnl;
      if (pnl > largestWin) largestWin = pnl;

      tempWin++;
      if (tempWin > bestStreak) bestStreak = tempWin;
      tempLoss = 0;

      if (currentStreakType === "WIN") currentStreakCount++;
      else {
        currentStreakType = "WIN";
        currentStreakCount = 1;
      }
    } else if (pnl < -0.01) {
      losingTrades++;
      const absLoss = Math.abs(pnl);
      grossLoss += absLoss;
      if (absLoss > largestLoss) largestLoss = absLoss;

      tempLoss++;
      if (tempLoss > worstStreak) worstStreak = tempLoss;
      tempWin = 0;

      if (currentStreakType === "LOSS") currentStreakCount++;
      else {
        currentStreakType = "LOSS";
        currentStreakCount = 1;
      }
    } else {
      breakevenCount++;
      tempWin = 0;
      tempLoss = 0;
    }

    if (t.rr !== null && !isNaN(t.rr)) {
      totalRR += t.rr;
      validRRCount++;
    }
  });

  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const lossRate = totalTrades > 0 ? (losingTrades / totalTrades) * 100 : 0;

  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? grossProfit : 0;
  const averageWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const averageLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;

  const winFrac = winRate / 100;
  const lossFrac = lossRate / 100;
  const expectancy = winFrac * averageWin - lossFrac * averageLoss;

  const averageRR = validRRCount > 0 ? parseFloat((totalRR / validRRCount).toFixed(2)) : null;
  const avgHoldMs = validHoldCount > 0 ? totalHoldMs / validHoldCount : null;

  return {
    netProfit: parseFloat(netProfit.toFixed(2)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    grossLoss: parseFloat(grossLoss.toFixed(2)),
    balance: parseFloat((initialBalance + netProfit).toFixed(2)),
    winRate: parseFloat(winRate.toFixed(1)),
    lossRate: parseFloat(lossRate.toFixed(1)),
    breakevenCount,
    totalTrades,
    winningTrades,
    losingTrades,
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2)),
    averageWin: parseFloat(averageWin.toFixed(2)),
    averageLoss: parseFloat(averageLoss.toFixed(2)),
    largestWin: parseFloat(largestWin.toFixed(2)),
    largestLoss: parseFloat(largestLoss.toFixed(2)),
    averageRR,
    averageHoldTime: formatHoldDuration(avgHoldMs),
    currentStreak: { type: currentStreakType, count: currentStreakCount },
    bestStreak,
    worstStreak,
    totalCommission: parseFloat(totalCommission.toFixed(2)),
    totalSwap: parseFloat(totalSwap.toFixed(2)),
    dailyPnL: parseFloat(dailyPnL.toFixed(2)),
    weeklyPnL: parseFloat(weeklyPnL.toFixed(2)),
    monthlyPnL: parseFloat(monthlyPnL.toFixed(2)),
  };
}

export function getEngineEquityCurve(trades: NormalizedTrade[], initialBalance = 10000): EquityPoint[] {
  if (!trades || trades.length === 0) return [];
  const sorted = [...trades].sort((a, b) =>
    compareAsc(parseISO(a.closeTime), parseISO(b.closeTime))
  );

  let currentEquity = initialBalance;
  let cumulativePnL = 0;

  const points: EquityPoint[] = [
    {
      date: sorted.length > 0 && sorted[0].openTime ? format(parseISO(sorted[0].openTime), "MMM dd") : "Start",
      pnl: 0,
      equity: initialBalance,
      tradeCount: 0,
    },
  ];

  sorted.forEach((t, i) => {
    cumulativePnL += t.profit;
    currentEquity += t.profit;

    points.push({
      date: format(parseISO(t.closeTime), "MMM dd HH:mm"),
      pnl: parseFloat(cumulativePnL.toFixed(2)),
      equity: parseFloat(currentEquity.toFixed(2)),
      tradeCount: i + 1,
    });
  });

  return points;
}

export function getEngineDailyPnLSeries(trades: NormalizedTrade[]): DailyPnLPoint[] {
  if (!trades || trades.length === 0) return [];
  const map = new Map<string, { pnl: number; count: number; wins: number }>();

  trades.forEach((t) => {
    const dayKey = format(parseISO(t.closeTime), "yyyy-MM-dd");
    const existing = map.get(dayKey) || { pnl: 0, count: 0, wins: 0 };

    existing.pnl += t.profit;
    existing.count += 1;
    if (t.profit > 0) existing.wins += 1;

    map.set(dayKey, existing);
  });

  const keys = Array.from(map.keys()).sort();

  return keys.map((key) => {
    const item = map.get(key)!;
    return {
      date: format(parseISO(key), "MMM dd"),
      pnl: parseFloat(item.pnl.toFixed(2)),
      trades: item.count,
      winRate: parseFloat(((item.wins / item.count) * 100).toFixed(0)),
    };
  });
}

export function getEngineMonthlyPnLSeries(trades: NormalizedTrade[]): MonthlyPnLPoint[] {
  if (!trades || trades.length === 0) return [];
  const map = new Map<string, { pnl: number; trades: number }>();

  trades.forEach((t) => {
    const monthKey = format(parseISO(t.closeTime), "MMM yyyy");
    const existing = map.get(monthKey) || { pnl: 0, trades: 0 };
    existing.pnl += t.profit;
    existing.trades += 1;
    map.set(monthKey, existing);
  });

  return Array.from(map.entries()).map(([month, val]) => ({
    month,
    pnl: parseFloat(val.pnl.toFixed(2)),
    trades: val.trades,
  }));
}

export function getEngineDrawdownSeries(trades: NormalizedTrade[], initialBalance = 10000): DrawdownPoint[] {
  if (!trades || trades.length === 0) return [];
  const sorted = [...trades].sort((a, b) =>
    compareAsc(parseISO(a.closeTime), parseISO(b.closeTime))
  );

  let peakEquity = initialBalance;
  let currentEquity = initialBalance;

  return sorted.map((t) => {
    currentEquity += t.profit;
    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }

    const drawdown = currentEquity - peakEquity;
    const drawdownPercent = peakEquity > 0 ? (drawdown / peakEquity) * 100 : 0;

    return {
      date: format(parseISO(t.closeTime), "MMM dd"),
      drawdown: parseFloat(drawdown.toFixed(2)),
      drawdownPercent: parseFloat(drawdownPercent.toFixed(2)),
    };
  });
}

export function getEngineProfitDistribution(trades: NormalizedTrade[]): ProfitDistributionPoint[] {
  if (!trades || trades.length === 0) return [];
  const ranges = [
    { label: "< -$1,000", min: -Infinity, max: -1000, count: 0 },
    { label: "-$1k to -$500", min: -1000, max: -500, count: 0 },
    { label: "-$500 to $0", min: -500, max: 0, count: 0 },
    { label: "$0 to $500", min: 0, max: 500, count: 0 },
    { label: "$500 to $1.5k", min: 500, max: 1500, count: 0 },
    { label: "> $1.5k", min: 1500, max: Infinity, count: 0 },
  ];

  trades.forEach((t) => {
    const r = ranges.find((rg) => t.profit >= rg.min && t.profit < rg.max);
    if (r) r.count++;
  });

  return ranges.map((r) => ({ range: r.label, count: r.count }));
}

export function getEngineSymbolPerformance(trades: NormalizedTrade[]) {
  if (!trades || trades.length === 0) return [];
  const map = new Map<
    string,
    { symbol: string; trades: number; pnl: number; wins: number; losses: number }
  >();

  trades.forEach((t) => {
    const existing = map.get(t.symbol) || {
      symbol: t.symbol,
      trades: 0,
      pnl: 0,
      wins: 0,
      losses: 0,
    };
    existing.trades++;
    existing.pnl += t.profit;
    if (t.profit > 0) existing.wins++;
    else if (t.profit < 0) existing.losses++;
    map.set(t.symbol, existing);
  });

  return Array.from(map.values()).map((s) => ({
    ...s,
    winRate: parseFloat(((s.wins / s.trades) * 100).toFixed(1)),
    pnl: parseFloat(s.pnl.toFixed(2)),
  }));
}
