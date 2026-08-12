"use client";

import React, { useMemo } from "react";
import { MT5Header } from "@/components/mt5/MT5Header";
import { useMT5Companion } from "@/context/MT5CompanionContext";
import { useTheme } from "@/context/ThemeContext";
import { BarChart3, TrendingUp, Award, Target, Zap, ShieldCheck, DollarSign } from "lucide-react";

export default function MT5ReportsPage() {
  const { trades, selectedAccount, isLoading } = useMT5Companion();
  const { theme } = useTheme();
  const isLight = theme === "light";

  // Filter closed trades
  const closedTrades = useMemo(() => {
    return trades.filter((t) => t.status === "CLOSED" && (t.closeTime || t.openTime));
  }, [trades]);

  // Overall Performance Summary
  const stats = useMemo(() => {
    const totalCount = closedTrades.length;
    let netPnl = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let winCount = 0;
    let lossCount = 0;

    closedTrades.forEach((tr) => {
      const netVal = tr.profit + (tr.commission || 0) + (tr.swap || 0);
      netPnl += netVal;
      if (netVal >= 0) {
        winCount++;
        grossProfit += netVal;
      } else {
        lossCount++;
        grossLoss += Math.abs(netVal);
      }
    });

    const winRate = totalCount > 0 ? (winCount / totalCount) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999.99 : 0;
    const avgWin = winCount > 0 ? grossProfit / winCount : 0;
    const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0;
    const expectancy = totalCount > 0 ? (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss) : 0;

    return {
      totalCount,
      netPnl,
      grossProfit,
      grossLoss,
      winCount,
      lossCount,
      winRate,
      profitFactor,
      expectancy,
    };
  }, [closedTrades]);

  // Symbol Breakdown
  const symbolStats = useMemo(() => {
    const map = new Map<string, { symbol: string; count: number; netPnl: number; wins: number; grossProfit: number; grossLoss: number }>();

    closedTrades.forEach((tr) => {
      const sym = tr.symbol || "OTHER";
      const netVal = tr.profit + (tr.commission || 0) + (tr.swap || 0);
      const item = map.get(sym) || { symbol: sym, count: 0, netPnl: 0, wins: 0, grossProfit: 0, grossLoss: 0 };
      
      item.count++;
      item.netPnl += netVal;
      if (netVal >= 0) {
        item.wins++;
        item.grossProfit += netVal;
      } else {
        item.grossLoss += Math.abs(netVal);
      }
      map.set(sym, item);
    });

    return Array.from(map.values()).sort((a, b) => b.netPnl - a.netPnl);
  }, [closedTrades]);

  // Day of Week Breakdown
  const dayOfWeekStats = useMemo(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const map = new Map<number, { dayName: string; count: number; netPnl: number; wins: number }>();

    days.forEach((dayName, idx) => {
      map.set(idx, { dayName, count: 0, netPnl: 0, wins: 0 });
    });

    closedTrades.forEach((tr) => {
      const dateObj = new Date(tr.closeTime || tr.openTime);
      const dayIdx = dateObj.getDay();
      const netVal = tr.profit + (tr.commission || 0) + (tr.swap || 0);
      const item = map.get(dayIdx)!;
      item.count++;
      item.netPnl += netVal;
      if (netVal >= 0) item.wins++;
    });

    return Array.from(map.values()).filter((d) => d.dayName !== "Sunday" && d.dayName !== "Saturday");
  }, [closedTrades]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-28 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse" />
        <div className="h-24 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse" />
        <div className="h-80 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (!selectedAccount) {
    return (
      <div className="space-y-6 pb-12 font-sans">
        <MT5Header
          title="MT5 PERFORMANCE REPORTS"
          subtitle="Canonical closed trade analytical breakdown, symbol matrix & day-of-week performance"
        />

        <div className={`p-8 sm:p-12 rounded-3xl border shadow-xl text-center space-y-5 max-w-3xl mx-auto my-8 ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"}`}>
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <BarChart3 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold font-sans">No Account Selected</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
              No MT5 account is currently connected. Connect an MT5 account to view analytical performance reports.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currencySymbol = selectedAccount.currency === "USC" ? "USC" : "$";

  return (
    <div className="space-y-6 pb-12 font-sans">
      <MT5Header
        title="MT5 PERFORMANCE REPORTS"
        subtitle="Canonical closed trade analytical breakdown, symbol matrix & day-of-week performance"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 font-mono">
        <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"}`}>
          <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">REALIZED NET P/L</span>
          <span className={`text-lg font-extrabold ${stats.netPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {stats.netPnl >= 0 ? "+" : ""}{currencySymbol}{stats.netPnl.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{stats.totalCount} closed trades</span>
        </div>

        <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"}`}>
          <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">WIN RATE</span>
          <span className="text-lg font-extrabold text-white">{stats.winRate.toFixed(1)}%</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{stats.winCount} W / {stats.lossCount} L</span>
        </div>

        <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"}`}>
          <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">PROFIT FACTOR</span>
          <span className="text-lg font-extrabold text-white">{stats.profitFactor > 100 ? "MAX" : stats.profitFactor.toFixed(2)}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Gross W / Gross L</span>
        </div>

        <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
          <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">EXPECTANCY</span>
          <span className={`text-lg font-extrabold ${stats.expectancy >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {stats.expectancy >= 0 ? "+" : ""}${stats.expectancy.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Per trade value</span>
        </div>

        <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
          <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">GROSS PROFIT</span>
          <span className="text-lg font-extrabold text-emerald-500">+${stats.grossProfit.toFixed(2)}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Total gains</span>
        </div>

        <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
          <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">GROSS LOSS</span>
          <span className="text-lg font-extrabold text-rose-500">-${stats.grossLoss.toFixed(2)}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Total losses</span>
        </div>
      </div>

      {/* Main Grid: Symbol Matrix & Day of Week Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Symbol Performance Breakdown */}
        <div className={`p-6 rounded-3xl border shadow-xl space-y-4 font-mono text-xs ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08] text-white"}`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-white/[0.08]">
            <h2 className="text-base font-bold font-sans tracking-tight">Symbol Performance Matrix</h2>
            <span className="text-[10px] text-slate-400">{symbolStats.length} Instruments</span>
          </div>

          {symbolStats.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs font-mono">No closed trades available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Trades</th>
                    <th className="py-2.5 px-3">Win Rate</th>
                    <th className="py-2.5 px-3 text-right">Net P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {symbolStats.map((sym) => {
                    const wr = sym.count > 0 ? ((sym.wins / sym.count) * 100).toFixed(1) : "0.0";
                    const isProf = sym.netPnl >= 0;

                    return (
                      <tr key={sym.symbol}>
                        <td className="py-2.5 px-3 font-extrabold">{sym.symbol}</td>
                        <td className="py-2.5 px-3 font-bold">{sym.count}</td>
                        <td className="py-2.5 px-3">{wr}%</td>
                        <td className="py-2.5 px-3 text-right font-extrabold">
                          <span className={isProf ? "text-emerald-500" : "text-rose-500"}>
                            {isProf ? "+" : ""}${sym.netPnl.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Day-of-Week Performance */}
        <div className={`p-6 rounded-3xl border shadow-xl space-y-4 font-mono text-xs ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08] text-white"}`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-white/[0.08]">
            <h2 className="text-base font-bold font-sans tracking-tight">Day-of-Week Breakdown</h2>
            <span className="text-[10px] text-slate-400">Monday–Friday</span>
          </div>

          <div className="space-y-3">
            {dayOfWeekStats.map((day) => {
              const wr = day.count > 0 ? ((day.wins / day.count) * 100).toFixed(1) : "0.0";
              const isProf = day.netPnl >= 0;

              return (
                <div key={day.dayName} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm font-sans block">{day.dayName}</span>
                    <span className="text-[10px] text-slate-400">{day.count} trades | {wr}% win rate</span>
                  </div>
                  <span className={`text-base font-extrabold font-mono ${isProf ? "text-emerald-500" : "text-rose-500"}`}>
                    {isProf ? "+" : ""}${day.netPnl.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

