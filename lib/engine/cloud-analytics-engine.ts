// lib/engine/cloud-analytics-engine.ts
// Comprehensive institutional analytics engine operating on CloudTrade objects.
// Computes metrics for performance lab, symbol analytics, time/session analytics, and equity curve.

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

  // Long vs Short
  longTrades: number;
  longWins: number;
  longPnL: number;
  longWinRate: number;
  shortTrades: number;
  shortWins: number;
  shortPnL: number;
  shortWinRate: number;

  // Highlights / Superlatives
  bestSymbol: SymbolPerformance | null;
  worstSymbol: SymbolPerformance | null;
  mostConsistentSymbol: SymbolPerformance | null;
  highestWinRateSymbol: SymbolPerformance | null;
  highestRRSymbol: SymbolPerformance | null;
  highestVolumeSymbol: SymbolPerformance | null;
  bestHour: PeriodPerformance | null;
  worstHour: PeriodPerformance | null;

  // Breakdown Collections
  symbols: SymbolPerformance[];
  daysOfWeek: PeriodPerformance[];
  hoursOfDay: PeriodPerformance[];
  sessions: SessionPerformance[];
  equityCurve: EquityPoint[];
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
  let totalCommission = 0;
  let totalSwap = 0;
  let totalHoldSeconds = 0;
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

  // Equity Curve Points
  const equityCurve: EquityPoint[] = [];
  let runningPnL = 0;

  sorted.forEach((trade) => {
    const pnl = trade.net_profit ?? (trade.profit + trade.commission + trade.swap);
    netProfit += pnl;
    runningPnL += pnl;
    totalVolume += Number(trade.volume || 0);
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
      totalHoldSeconds += Number(trade.duration_seconds);
      holdCount++;
    }

    // Equity point
    const dateStr = trade.close_time
      ? format(parseISO(trade.close_time), 'yyyy-MM-dd HH:mm')
      : format(new Date(trade.created_at), 'yyyy-MM-dd HH:mm');

    equityCurve.push({
      date: dateStr,
      timestamp: new Date(trade.close_time || trade.created_at).getTime(),
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
    const tradeDate = trade.close_time ? parseISO(trade.close_time) : new Date(trade.created_at);
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

  // Expectancy = (Win Rate % * Avg Win) - (Loss Rate % * Avg Loss)
  const expectancy = (winRate / 100) * avgWin - (lossRate / 100) * avgLoss;
  const avgRR = rrCount > 0 ? totalRR / rrCount : avgLoss > 0 ? avgWin / avgLoss : 0;
  const avgHoldSeconds = holdCount > 0 ? Math.round(totalHoldSeconds / holdCount) : 0;

  const longWinRate = longTrades > 0 ? (longWins / longTrades) * 100 : 0;
  const shortWinRate = shortTrades > 0 ? (shortWins / shortTrades) * 100 : 0;

  // Compute Symbol Analytics
  const symbols: SymbolPerformance[] = Array.from(symbolMap.entries()).map(([sym, symTrades]) => {
    return computeSymbolPerformance(sym, symTrades);
  }).sort((a, b) => b.netProfit - a.netProfit);

  // Compute Days of Week
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daysOfWeek: PeriodPerformance[] = [1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
    const dayTrades = dayMap.get(dayIdx) || [];
    return computePeriodPerformance(DAY_NAMES[dayIdx], dayTrades);
  });

  // Compute Hours of Day
  const hoursOfDay: PeriodPerformance[] = Array.from({ length: 24 }).map((_, h) => {
    const hTrades = hourMap.get(h) || [];
    const hourLabel = `${h.toString().padStart(2, '0')}:00`;
    return computePeriodPerformance(hourLabel, hTrades);
  });

  // Compute Sessions
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

    longTrades,
    longWins,
    longPnL: Number(longPnL.toFixed(2)),
    longWinRate: Number(longWinRate.toFixed(1)),
    shortTrades,
    shortWins,
    shortPnL: Number(shortPnL.toFixed(2)),
    shortWinRate: Number(shortWinRate.toFixed(1)),

    bestSymbol,
    worstSymbol,
    mostConsistentSymbol,
    highestWinRateSymbol,
    highestRRSymbol,
    highestVolumeSymbol,
    bestHour,
    worstHour,

    symbols,
    daysOfWeek,
    hoursOfDay,
    sessions,
    equityCurve,
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

    longTrades: 0,
    longWins: 0,
    longPnL: 0,
    longWinRate: 0,
    shortTrades: 0,
    shortWins: 0,
    shortPnL: 0,
    shortWinRate: 0,

    bestSymbol: null,
    worstSymbol: null,
    mostConsistentSymbol: null,
    highestWinRateSymbol: null,
    highestRRSymbol: null,
    highestVolumeSymbol: null,
    bestHour: null,
    worstHour: null,

    symbols: [],
    daysOfWeek: [],
    hoursOfDay: [],
    sessions: [],
    equityCurve: [],
  };
}
