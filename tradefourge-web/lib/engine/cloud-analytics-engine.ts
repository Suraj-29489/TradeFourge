// lib/engine/cloud-analytics-engine.ts
// Comprehensive institutional analytics engine operating on CloudTrade objects.
// Computes metrics for performance lab, symbol analytics, time/session analytics, trader classification, and equity curve.

import { CloudTradeWithRelations, CloudTrade } from '@/types/database';
import { parseISO, format, getHours, getDay } from 'date-fns';

export interface SymbolPerformance {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  lossRate: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgRR: number;
  largestWin: number;
  largestLoss: number;
  totalVolume: number;
  avgLotSize: number;
  longTrades: number;
  shortTrades: number;
  longWinRate: number;
  shortWinRate: number;
  avgHoldSeconds: number;
}

export interface PeriodPerformance {
  period: string; // e.g., '2026-07' or 'Monday' or '14:00'
  trades: number;
  wins: number;
  losses: number;
  netProfit: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
}

export interface SessionPerformance {
  session: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
  avgRR: number;
}

export interface EquityPoint {
  date: string;
  timestamp: number;
  tradeProfit: number;
  cumulativeProfit: number;
  tradeTicket: string;
  symbol: string;
}

export interface TraderClassification {
  title: string;
  badge: string;
  description: string;
  color: string; // Tailwind color class
}

export interface CompleteAnalyticsSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  lossRate: number;
  breakevenRate: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  avgRR: number;
  largestWin: number;
  largestLoss: number;
  totalVolume: number;
  totalCommission: number;
  totalSwap: number;
  avgHoldSeconds: number;
  longestHoldSeconds: number;
  shortestHoldSeconds: number;

  // New Metrics
  avgLotSize: number;
  largestLotSize: number;
  smallestLotSize: number;
  avgProfitPerTrade: number;
  avgLossPerTrade: number;
  avgDailyProfit: number;
  avgWeeklyProfit: number;

  // Long vs Short
  longTrades: number;
  longWins: number;
  longPnL: number;
  longWinRate: number;
  shortTrades: number;
  shortWins: number;
  shortPnL: number;
  shortWinRate: number;

  // Trader Classification
  classification: TraderClassification;

  // Highlights / Superlatives
  bestSymbol: SymbolPerformance | null;
  worstSymbol: SymbolPerformance | null;
  mostConsistentSymbol: SymbolPerformance | null;
  highestWinRateSymbol: SymbolPerformance | null;
  highestRRSymbol: SymbolPerformance | null;
  highestVolumeSymbol: SymbolPerformance | null;
  bestHour: PeriodPerformance | null;
  worstHour: PeriodPerformance | null;
  bestDay: PeriodPerformance | null;
  worstDay: PeriodPerformance | null;

  // Breakdown Collections
  symbols: SymbolPerformance[];
  daysOfWeek: PeriodPerformance[];
  hoursOfDay: PeriodPerformance[];
  sessions: SessionPerformance[];
  equityCurve: EquityPoint[];
  insights: string[];
}

/**
 * Main calculator function that computes full analytics on a set of cloud trades.
 */
export function calculateCloudAnalytics(trades: (CloudTrade | CloudTradeWithRelations)[]): CompleteAnalyticsSummary {
  if (!trades || trades.length === 0) {
    return createEmptyAnalytics();
  }

  // Sort trades chronologically by close_time (or open_time)
  const sorted = [...trades].sort((a, b) => {
    const timeA = new Date(a.close_time || a.open_time || a.created_at).getTime();
    const timeB = new Date(b.close_time || b.open_time || b.created_at).getTime();
    return timeA - timeB;
  });

  const totalTrades = sorted.length;
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let netProfit = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalWinAmount = 0;
  let totalLossAmount = 0;
  let largestWin = 0;
  let largestLoss = 0;
  let totalRR = 0;
  let rrCount = 0;
  let totalVolume = 0;
  let largestLotSize = 0;
  let smallestLotSize = Infinity;
  let totalCommission = 0;
  let totalSwap = 0;
  let totalHoldSeconds = 0;
  let longestHoldSeconds = 0;
  let shortestHoldSeconds = Infinity;
  let holdCount = 0;

  // Long vs Short
  let longTrades = 0;
  let longWins = 0;
  let longPnL = 0;
  let shortTrades = 0;
  let shortWins = 0;
  let shortPnL = 0;

  // Group maps
  const symbolMap = new Map<string, (CloudTrade | CloudTradeWithRelations)[]>();
  const dayMap = new Map<number, (CloudTrade | CloudTradeWithRelations)[]>(); // 0-6 (Sun-Sat)
  const hourMap = new Map<number, (CloudTrade | CloudTradeWithRelations)[]>(); // 0-23
  const sessionMap = new Map<string, (CloudTrade | CloudTradeWithRelations)[]>();
  const uniqueDatesSet = new Set<string>();

  // Equity Curve Points
  const equityCurve: EquityPoint[] = [];
  let runningPnL = 0;

  sorted.forEach((trade) => {
    const pnl = trade.net_profit ?? (trade.profit + trade.commission + trade.swap);
    netProfit += pnl;
    runningPnL += pnl;

    const vol = Number(trade.volume || 0);
    totalVolume += vol;
    if (vol > largestLotSize) largestLotSize = vol;
    if (vol > 0 && vol < smallestLotSize) smallestLotSize = vol;

    totalCommission += Number(trade.commission || 0);
    totalSwap += Number(trade.swap || 0);

    const isLong = trade.side === 'BUY' || trade.side === 'LONG';
    if (isLong) {
      longTrades++;
      longPnL += pnl;
      if (pnl > 0) longWins++;
    } else {
      shortTrades++;
      shortPnL += pnl;
      if (pnl > 0) shortWins++;
    }

    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
      totalWinAmount += pnl;
      if (pnl > largestWin) largestWin = pnl;
    } else if (pnl < 0) {
      losses++;
      const absLoss = Math.abs(pnl);
      grossLoss += absLoss;
      totalLossAmount += absLoss;
      if (pnl < largestLoss) largestLoss = pnl;
    } else {
      breakevens++;
    }

    if (trade.rr_ratio !== null && trade.rr_ratio !== undefined) {
      totalRR += Number(trade.rr_ratio);
      rrCount++;
    }

    if (trade.duration_seconds) {
      const duration = Number(trade.duration_seconds);
      totalHoldSeconds += duration;
      if (duration > longestHoldSeconds) longestHoldSeconds = duration;
      if (duration < shortestHoldSeconds) shortestHoldSeconds = duration;
      holdCount++;
    }

    // Equity point
    const tradeDate = trade.close_time ? parseISO(trade.close_time) : new Date(trade.created_at);
    const dateStr = format(tradeDate, 'yyyy-MM-dd HH:mm');
    uniqueDatesSet.add(format(tradeDate, 'yyyy-MM-dd'));

    equityCurve.push({
      date: dateStr,
      timestamp: tradeDate.getTime(),
      tradeProfit: pnl,
      cumulativeProfit: runningPnL,
      tradeTicket: trade.ticket || trade.id.slice(0, 8),
      symbol: trade.symbol,
    });

    // Grouping by symbol
    const symKey = (trade.symbol || 'UNKNOWN').toUpperCase();
    if (!symbolMap.has(symKey)) symbolMap.set(symKey, []);
    symbolMap.get(symKey)!.push(trade);

    // Grouping by Day of Week & Hour of Day
    if (!isNaN(tradeDate.getTime())) {
      const dayIdx = getDay(tradeDate); // 0 (Sun) .. 6 (Sat)
      if (!dayMap.has(dayIdx)) dayMap.set(dayIdx, []);
      dayMap.get(dayIdx)!.push(trade);

      const hourIdx = getHours(tradeDate); // 0..23
      if (!hourMap.has(hourIdx)) hourMap.set(hourIdx, []);
      hourMap.get(hourIdx)!.push(trade);
    }

    // Grouping by Session
    const sessKey = trade.session || detectSession(tradeDate);
    if (!sessionMap.has(sessKey)) sessionMap.set(sessKey, []);
    sessionMap.get(sessKey)!.push(trade);
  });

  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const lossRate = totalTrades > 0 ? (losses / totalTrades) * 100 : 0;
  const breakevenRate = totalTrades > 0 ? (breakevens / totalTrades) * 100 : 0;
  const avgWin = wins > 0 ? totalWinAmount / wins : 0;
  const avgLoss = losses > 0 ? totalLossAmount / losses : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 0;

  const expectancy = (winRate / 100) * avgWin - (lossRate / 100) * avgLoss;
  const avgRR = rrCount > 0 ? totalRR / rrCount : avgLoss > 0 ? avgWin / avgLoss : 0;
  const avgHoldSeconds = holdCount > 0 ? Math.round(totalHoldSeconds / holdCount) : 0;
  const avgLotSize = totalTrades > 0 ? totalVolume / totalTrades : 0;
  const avgProfitPerTrade = totalTrades > 0 ? netProfit / totalTrades : 0;
  const avgLossPerTrade = losses > 0 ? grossLoss / losses : 0;

  const uniqueDaysCount = Math.max(1, uniqueDatesSet.size);
  const avgDailyProfit = netProfit / uniqueDaysCount;
  const avgWeeklyProfit = netProfit / Math.max(1, uniqueDaysCount / 7);

  const longWinRate = longTrades > 0 ? (longWins / longTrades) * 100 : 0;
  const shortWinRate = shortTrades > 0 ? (shortWins / shortTrades) * 100 : 0;

  // Symbol Analytics
  const symbols: SymbolPerformance[] = Array.from(symbolMap.entries()).map(([sym, symTrades]) => {
    return computeSymbolPerformance(sym, symTrades);
  }).sort((a, b) => b.netProfit - a.netProfit);

  // Days of Week
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daysOfWeek: PeriodPerformance[] = [1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
    const dayTrades = dayMap.get(dayIdx) || [];
    return computePeriodPerformance(DAY_NAMES[dayIdx], dayTrades);
  });

  // Hours of Day
  const hoursOfDay: PeriodPerformance[] = Array.from({ length: 24 }).map((_, h) => {
    const hTrades = hourMap.get(h) || [];
    const hourLabel = `${h.toString().padStart(2, '0')}:00`;
    return computePeriodPerformance(hourLabel, hTrades);
  });

  // Sessions
  const sessions: SessionPerformance[] = ['London', 'New York', 'Tokyo', 'Sydney', 'London/NY Overlap', 'Other'].map((sessName) => {
    const sessTrades = sessionMap.get(sessName) || [];
    const sWins = sessTrades.filter(t => (t.net_profit ?? t.profit) > 0).length;
    const sPnL = sessTrades.reduce((sum, t) => sum + (t.net_profit ?? t.profit), 0);
    const sRR = sessTrades.reduce((sum, t) => sum + (t.rr_ratio ?? 0), 0);
    return {
      session: sessName,
      trades: sessTrades.length,
      wins: sWins,
      losses: sessTrades.length - sWins,
      winRate: sessTrades.length > 0 ? Number(((sWins / sessTrades.length) * 100).toFixed(1)) : 0,
      netProfit: sPnL,
      avgRR: sessTrades.length > 0 ? Number((sRR / sessTrades.length).toFixed(2)) : 0,
    };
  });

  // Highlights
  const bestSymbol = symbols.length > 0 ? symbols[0] : null;
  const worstSymbol = symbols.length > 0 ? [...symbols].sort((a, b) => a.netProfit - b.netProfit)[0] : null;
  const mostConsistentSymbol = symbols.length > 0 ? [...symbols].sort((a, b) => b.winRate - a.winRate)[0] : null;
  const highestWinRateSymbol = mostConsistentSymbol;
  const highestRRSymbol = symbols.length > 0 ? [...symbols].sort((a, b) => b.avgRR - a.avgRR)[0] : null;
  const highestVolumeSymbol = symbols.length > 0 ? [...symbols].sort((a, b) => b.totalVolume - a.totalVolume)[0] : null;

  const activeHours = hoursOfDay.filter(h => h.trades > 0);
  const bestHour = activeHours.length > 0 ? [...activeHours].sort((a, b) => b.netProfit - a.netProfit)[0] : null;
  const worstHour = activeHours.length > 0 ? [...activeHours].sort((a, b) => a.netProfit - b.netProfit)[0] : null;

  const activeDays = daysOfWeek.filter(d => d.trades > 0);
  const bestDay = activeDays.length > 0 ? [...activeDays].sort((a, b) => b.netProfit - a.netProfit)[0] : null;
  const worstDay = activeDays.length > 0 ? [...activeDays].sort((a, b) => a.netProfit - b.netProfit)[0] : null;

  // Trader Classification
  const classification = classifyTrader({
    totalTrades,
    winRate,
    profitFactor,
    netProfit,
    avgHoldSeconds,
    avgRR,
    avgLoss,
    avgWin,
  });

  return {
    totalTrades,
    wins,
    losses,
    breakevens,
    winRate: Number(winRate.toFixed(1)),
    lossRate: Number(lossRate.toFixed(1)),
    breakevenRate: Number(breakevenRate.toFixed(1)),
    netProfit: Number(netProfit.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    avgWin: Number(avgWin.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    expectancy: Number(expectancy.toFixed(2)),
    avgRR: Number(avgRR.toFixed(2)),
    largestWin: Number(largestWin.toFixed(2)),
    largestLoss: Number(largestLoss.toFixed(2)),
    totalVolume: Number(totalVolume.toFixed(2)),
    totalCommission: Number(totalCommission.toFixed(2)),
    totalSwap: Number(totalSwap.toFixed(2)),
    avgHoldSeconds,
    longestHoldSeconds: longestHoldSeconds === Infinity ? 0 : longestHoldSeconds,
    shortestHoldSeconds: shortestHoldSeconds === Infinity ? 0 : shortestHoldSeconds,

    avgLotSize: Number(avgLotSize.toFixed(2)),
    largestLotSize: Number(largestLotSize.toFixed(2)),
    smallestLotSize: smallestLotSize === Infinity ? 0 : Number(smallestLotSize.toFixed(2)),
    avgProfitPerTrade: Number(avgProfitPerTrade.toFixed(2)),
    avgLossPerTrade: Number(avgLossPerTrade.toFixed(2)),
    avgDailyProfit: Number(avgDailyProfit.toFixed(2)),
    avgWeeklyProfit: Number(avgWeeklyProfit.toFixed(2)),

    longTrades,
    longWins,
    longPnL: Number(longPnL.toFixed(2)),
    longWinRate: Number(longWinRate.toFixed(1)),
    shortTrades,
    shortWins,
    shortPnL: Number(shortPnL.toFixed(2)),
    shortWinRate: Number(shortWinRate.toFixed(1)),

    classification,

    bestSymbol,
    worstSymbol,
    mostConsistentSymbol,
    highestWinRateSymbol,
    highestRRSymbol,
    highestVolumeSymbol,
    bestHour,
    worstHour,
    bestDay,
    worstDay,

    symbols,
    daysOfWeek,
    hoursOfDay,
    sessions,
    equityCurve,
    insights: generateInsights({
      totalTrades,
      netProfit,
      winRate,
      profitFactor,
      bestSymbol,
      worstSymbol,
      bestSession: sessions.filter(s => s.trades > 0).sort((a, b) => b.netProfit - a.netProfit)[0] || null,
      bestDay,
      longWinRate,
      shortWinRate,
      classificationTitle: classification.title,
    }),
  };
}

function generateInsights(params: {
  totalTrades: number;
  netProfit: number;
  winRate: number;
  profitFactor: number;
  bestSymbol: SymbolPerformance | null;
  worstSymbol: SymbolPerformance | null;
  bestSession: SessionPerformance | null;
  bestDay: PeriodPerformance | null;
  longWinRate: number;
  shortWinRate: number;
  classificationTitle: string;
}): string[] {
  if (params.totalTrades === 0) {
    return ["Upload or log trades to generate deterministic trade intelligence insights."];
  }

  const list: string[] = [];

  list.push(`You are currently in a ${params.classificationTitle} phase.`);

  if (params.bestSymbol && params.bestSymbol.netProfit > 0) {
    list.push(`${params.bestSymbol.symbol} is currently your strongest market with $${params.bestSymbol.netProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })} net profit (${params.bestSymbol.winRate}% WR).`);
  }

  if (params.bestSession && params.bestSession.netProfit > 0) {
    list.push(`You perform best during ${params.bestSession.session} Session ($${params.bestSession.netProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })} net profit).`);
  }

  if (params.bestDay && params.bestDay.netProfit > 0) {
    list.push(`${params.bestDay.period} is your most profitable trading day.`);
  }

  if (params.longWinRate > params.shortWinRate && params.longWinRate > 0) {
    list.push(`Your Long positions (${params.longWinRate.toFixed(1)}% WR) outperform Short positions (${params.shortWinRate.toFixed(1)}% WR).`);
  } else if (params.shortWinRate > params.longWinRate && params.shortWinRate > 0) {
    list.push(`Your Short positions (${params.shortWinRate.toFixed(1)}% WR) outperform Long positions (${params.longWinRate.toFixed(1)}% WR).`);
  }

  if (params.profitFactor >= 1.5) {
    list.push(`Your Profit Factor of ${params.profitFactor.toFixed(2)} reflects positive expectancy and strong risk management.`);
  }

  return list;
}

function classifyTrader(params: {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  netProfit: number;
  avgHoldSeconds: number;
  avgRR: number;
  avgLoss: number;
  avgWin: number;
}): TraderClassification {
  const { totalTrades, winRate, profitFactor, netProfit, avgHoldSeconds, avgRR, avgLoss, avgWin } = params;

  if (totalTrades < 10) {
    return {
      title: "Learning Phase",
      badge: "INITIALIZING",
      description: "Log at least 10 trades to unlock institutional statistical profile classification.",
      color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    };
  }

  if (profitFactor >= 2.0 && winRate >= 60 && avgRR >= 1.5) {
    return {
      title: "Institutional Discipline",
      badge: "ELITE TRADER",
      description: "Exhibits institutional risk management, high profit factor (>2.0), and superior R:R ratios.",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    };
  }

  if (profitFactor >= 1.5 && netProfit > 0) {
    return {
      title: "Consistently Profitable",
      badge: "PROFITABLE",
      description: "Demonstrates positive expectancy and sustainable win-to-loss distribution.",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    };
  }

  if (avgHoldSeconds > 0 && avgHoldSeconds < 900 && totalTrades >= 20) {
    return {
      title: "Aggressive Scalper",
      badge: "SCALPER",
      description: "Executes rapid short-duration positions with average holding time under 15 minutes.",
      color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    };
  }

  if (avgHoldSeconds >= 86400) {
    return {
      title: "Swing Trader",
      badge: "SWING TRADER",
      description: "Holds positions over multi-day periods to capture macro trend movements.",
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
    };
  }

  if (avgLoss > 3 * Math.max(1, avgWin) || (winRate < 40 && profitFactor < 0.8)) {
    return {
      title: "High Risk Trader",
      badge: "HIGH RISK",
      description: "Position sizing and loss management require immediate tightening to mitigate drawdown risk.",
      color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    };
  }

  if (winRate >= 45 && winRate <= 55) {
    return {
      title: "Breakeven Trader",
      badge: "BREAKEVEN",
      description: "Performance is near equilibrium. Focus on increasing average win size relative to loss.",
      color: "text-gray-300 bg-gray-500/10 border-gray-500/30",
    };
  }

  return {
    title: "Systematic Trader",
    badge: "ACTIVE",
    description: "Developing consistent strategy parameters across markets.",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  };
}

function computeSymbolPerformance(symbol: string, trades: (CloudTrade | CloudTradeWithRelations)[]): SymbolPerformance {
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let netProfit = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalWin = 0;
  let totalLoss = 0;
  let largestWin = 0;
  let largestLoss = 0;
  let totalRR = 0;
  let rrCount = 0;
  let totalVolume = 0;
  let longTrades = 0;
  let longWins = 0;
  let shortTrades = 0;
  let shortWins = 0;
  let totalHold = 0;
  let holdCount = 0;

  trades.forEach((t) => {
    const pnl = t.net_profit ?? (t.profit + t.commission + t.swap);
    netProfit += pnl;
    totalVolume += Number(t.volume || 0);

    const isLong = t.side === 'BUY' || t.side === 'LONG';
    if (isLong) {
      longTrades++;
      if (pnl > 0) longWins++;
    } else {
      shortTrades++;
      if (pnl > 0) shortWins++;
    }

    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
      totalWin += pnl;
      if (pnl > largestWin) largestWin = pnl;
    } else if (pnl < 0) {
      losses++;
      const absLoss = Math.abs(pnl);
      grossLoss += absLoss;
      totalLoss += absLoss;
      if (pnl < largestLoss) largestLoss = pnl;
    } else {
      breakevens++;
    }

    if (t.rr_ratio !== null && t.rr_ratio !== undefined) {
      totalRR += Number(t.rr_ratio);
      rrCount++;
    }

    if (t.duration_seconds) {
      totalHold += Number(t.duration_seconds);
      holdCount++;
    }
  });

  const total = trades.length;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const lossRate = total > 0 ? (losses / total) * 100 : 0;
  const avgWin = wins > 0 ? totalWin / wins : 0;
  const avgLoss = losses > 0 ? totalLoss / losses : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 0;
  const avgRR = rrCount > 0 ? totalRR / rrCount : avgLoss > 0 ? avgWin / avgLoss : 0;
  const avgLotSize = total > 0 ? totalVolume / total : 0;

  return {
    symbol,
    trades: total,
    wins,
    losses,
    breakevens,
    winRate: Number(winRate.toFixed(1)),
    lossRate: Number(lossRate.toFixed(1)),
    netProfit: Number(netProfit.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    avgWin: Number(avgWin.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    avgRR: Number(avgRR.toFixed(2)),
    largestWin: Number(largestWin.toFixed(2)),
    largestLoss: Number(largestLoss.toFixed(2)),
    totalVolume: Number(totalVolume.toFixed(2)),
    avgLotSize: Number(avgLotSize.toFixed(2)),
    longTrades,
    shortTrades,
    longWinRate: longTrades > 0 ? Number(((longWins / longTrades) * 100).toFixed(1)) : 0,
    shortWinRate: shortTrades > 0 ? Number(((shortWins / shortTrades) * 100).toFixed(1)) : 0,
    avgHoldSeconds: holdCount > 0 ? Math.round(totalHold / holdCount) : 0,
  };
}

function computePeriodPerformance(period: string, trades: (CloudTrade | CloudTradeWithRelations)[]): PeriodPerformance {
  let wins = 0;
  let losses = 0;
  let netProfit = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  trades.forEach((t) => {
    const pnl = t.net_profit ?? (t.profit + t.commission + t.swap);
    netProfit += pnl;
    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
    } else if (pnl < 0) {
      losses++;
      grossLoss += Math.abs(pnl);
    }
  });

  const total = trades.length;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 0;

  return {
    period,
    trades: total,
    wins,
    losses,
    netProfit: Number(netProfit.toFixed(2)),
    winRate: Number(winRate.toFixed(1)),
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
  };
}

function detectSession(date: Date): string {
  const hour = getHours(date); // UTC or local
  if (hour >= 13 && hour < 16) return 'London/NY Overlap';
  if (hour >= 8 && hour < 16) return 'London';
  if (hour >= 13 && hour < 21) return 'New York';
  if (hour >= 0 && hour < 8) return 'Tokyo';
  if (hour >= 21 || hour < 6) return 'Sydney';
  return 'Other';
}

function createEmptyAnalytics(): CompleteAnalyticsSummary {
  return {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    breakevens: 0,
    winRate: 0,
    lossRate: 0,
    breakevenRate: 0,
    netProfit: 0,
    grossProfit: 0,
    grossLoss: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    expectancy: 0,
    avgRR: 0,
    largestWin: 0,
    largestLoss: 0,
    totalVolume: 0,
    totalCommission: 0,
    totalSwap: 0,
    avgHoldSeconds: 0,
    longestHoldSeconds: 0,
    shortestHoldSeconds: 0,

    avgLotSize: 0,
    largestLotSize: 0,
    smallestLotSize: 0,
    avgProfitPerTrade: 0,
    avgLossPerTrade: 0,
    avgDailyProfit: 0,
    avgWeeklyProfit: 0,

    longTrades: 0,
    longWins: 0,
    longPnL: 0,
    longWinRate: 0,
    shortTrades: 0,
    shortWins: 0,
    shortPnL: 0,
    shortWinRate: 0,

    classification: {
      title: "Learning Phase",
      badge: "INITIALIZING",
      description: "Log trades to generate institutional statistical profile.",
      color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    },

    bestSymbol: null,
    worstSymbol: null,
    mostConsistentSymbol: null,
    highestWinRateSymbol: null,
    highestRRSymbol: null,
    highestVolumeSymbol: null,
    bestHour: null,
    worstHour: null,
    bestDay: null,
    worstDay: null,

    symbols: [],
    daysOfWeek: [],
    hoursOfDay: [],
    sessions: [],
    equityCurve: [],
    insights: ["Import or log trades to generate deterministic trade intelligence insights."],
  };
}
