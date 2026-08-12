"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useMT5Companion } from "@/context/MT5CompanionContext";
import { MT5Header } from "@/components/mt5/MT5Header";
import { MT5Timeframe, MT5EquityPoint, MT5Trade } from "@/types/mt5";
import { MT5TradeDetailDrawer } from "@/components/mt5/MT5TradeDetailDrawer";
import {
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Server,
  CreditCard,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useTheme } from "@/context/ThemeContext";

export default function MT5DashboardPage() {
  const {
    selectedAccount,
    trades,
    isLoading,
    getEquityHistory,
    liveState,
    openPositions,
    isLiveStale,
    lastLiveUpdateText,
  } = useMT5Companion();

  const { theme } = useTheme();
  const isLight = theme === "light";

  const [timeframe, setTimeframe] = useState<MT5Timeframe>("1D");
  const [equityData, setEquityData] = useState<{
    points: MT5EquityPoint[];
    startingBalance: number;
    currentEquity: number;
    high: number;
    low: number;
  }>({
    points: [],
    startingBalance: 0,
    currentEquity: 0,
    high: 0,
    low: 0,
  });
  const [selectedTrade, setSelectedTrade] = useState<MT5Trade | null>(null);

  const loadEquity = useCallback(
    async (tf: MT5Timeframe) => {
      const data = await getEquityHistory(tf);
      setEquityData(data);
    },
    [getEquityHistory]
  );

  useEffect(() => {
    loadEquity(timeframe);
  }, [timeframe, loadEquity]);

  const recentExecutions = trades.slice(0, 8);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-28 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (!selectedAccount) {
    return (
      <div className="space-y-6 pb-12 font-sans">
        <MT5Header
          title="MT5 LIVE WORKSPACE"
          subtitle="Real-time terminal metrics, open positions & MT5 companion bridge"
        />

        <div className={`p-8 sm:p-12 rounded-3xl border shadow-xl text-center space-y-5 max-w-3xl mx-auto my-8 ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"}`}>
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <Server className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold font-sans">No Account Selected</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
              No MT5 account is currently connected. Connect an MT5 account to view account metrics and trading activity.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 font-mono text-xs text-left">
            <div className={`p-3 rounded-2xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/[0.02] border-white/[0.06]"}`}>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">BALANCE</span>
              <span className="text-sm font-bold text-slate-400">--</span>
            </div>
            <div className={`p-3 rounded-2xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/[0.02] border-white/[0.06]"}`}>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">EQUITY</span>
              <span className="text-sm font-bold text-slate-400">--</span>
            </div>
            <div className={`p-3 rounded-2xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/[0.02] border-white/[0.06]"}`}>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">FREE MARGIN</span>
              <span className="text-sm font-bold text-slate-400">--</span>
            </div>
            <div className={`p-3 rounded-2xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/[0.02] border-white/[0.06]"}`}>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">PROFIT TODAY</span>
              <span className="text-sm font-bold text-slate-400">--</span>
            </div>
            <div className={`p-3 rounded-2xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/[0.02] border-white/[0.06]"}`}>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">FLOATING P/L</span>
              <span className="text-sm font-bold text-slate-400">--</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Derive live vs account fallback values
  const displayBalance = liveState ? liveState.balance : selectedAccount.balance;
  const displayEquity = liveState ? liveState.equity : selectedAccount.equity;
  const displayFloatingPnl = liveState ? liveState.floatingPnl : selectedAccount.floatingPnl;
  const displayFreeMargin = liveState ? liveState.freeMargin : selectedAccount.freeMargin;
  const displayMargin = liveState ? liveState.margin : (selectedAccount.margin ?? 0);
  const displayMarginLevel = liveState && liveState.marginLevel !== null ? `${liveState.marginLevel.toFixed(1)}%` : "N/A";

  const isFloatingPositive = displayFloatingPnl >= 0;
  const isProfitTodayPositive = selectedAccount.profitToday >= 0;

  const isLiveConnected = liveState ? (!isLiveStale && liveState.isConnected) : false;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Persistent Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <MT5Header
          title="MT5 LIVE WORKSPACE"
          subtitle="Real-time terminal metrics, open positions, floating P/L & equity curve"
        />

        {/* Live Connection & Freshness Badge */}
        <div className="flex items-center gap-3 self-start sm:self-center">
          <div className="text-right font-mono text-xs">
            <span className="text-slate-400 text-[10px] block">FRESHNESS</span>
            <span className="text-slate-700 dark:text-gray-300 font-bold">{lastLiveUpdateText}</span>
          </div>

          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 ${
              isLiveConnected
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : isLiveStale && liveState
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                : "bg-slate-500/10 text-slate-500 dark:text-gray-400 border-slate-500/20"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLiveConnected
                  ? "bg-emerald-500 animate-pulse"
                  : isLiveStale && liveState
                  ? "bg-amber-500"
                  : "bg-slate-400"
              }`}
            />
            <span>
              {isLiveConnected
                ? "LIVE CONNECTED"
                : isLiveStale && liveState
                ? "STALE (PAUSED)"
                : "CONNECTOR OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* Account Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
        {/* Balance */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between space-y-2 transition-all ${
            isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 text-[11px] font-mono font-bold">
            <span>BALANCE</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 dark:text-white">
              ${displayBalance.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">
              {selectedAccount.currency} Account
            </span>
          </div>
        </div>

        {/* Equity */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between space-y-2 transition-all ${
            isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 text-[11px] font-mono font-bold">
            <span>EQUITY</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 dark:text-white">
              ${displayEquity.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Real-time valuation</span>
          </div>
        </div>

        {/* Floating P/L */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between space-y-2 transition-all ${
            isFloatingPositive
              ? isLight
                ? "bg-emerald-50/60 border-emerald-200"
                : "bg-emerald-500/10 border-emerald-500/20"
              : isLight
              ? "bg-rose-50/60 border-rose-200"
              : "bg-rose-500/10 border-rose-500/20"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 text-[11px] font-mono font-bold">
            <span>FLOATING P/L</span>
            <TrendingUp className={`w-4 h-4 ${isFloatingPositive ? "text-emerald-500" : "text-rose-500"}`} />
          </div>
          <div>
            <div
              className={`text-lg sm:text-xl font-extrabold font-mono ${
                isFloatingPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {isFloatingPositive ? "+" : ""}${displayFloatingPnl.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Open positions</span>
          </div>
        </div>

        {/* Margin */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between space-y-2 transition-all ${
            isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 text-[11px] font-mono font-bold">
            <span>MARGIN</span>
            <CreditCard className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 dark:text-white">
              ${displayMargin.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Used margin</span>
          </div>
        </div>

        {/* Free Margin */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between space-y-2 transition-all ${
            isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 text-[11px] font-mono font-bold">
            <span>FREE MARGIN</span>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 dark:text-white">
              ${displayFreeMargin.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Available capital</span>
          </div>
        </div>

        {/* Margin Level */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between space-y-2 transition-all ${
            isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 text-[11px] font-mono font-bold">
            <span>MARGIN LEVEL</span>
            <Zap className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 dark:text-white">
              {displayMarginLevel}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Health ratio</span>
          </div>
        </div>

        {/* Server & Account */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between space-y-2 transition-all ${
            isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 text-[11px] font-mono font-bold">
            <span>ACCOUNT</span>
            <Server className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white truncate">
              {selectedAccount.accountNumber}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono truncate block">
              {selectedAccount.server}
            </span>
          </div>
        </div>
      </div>

      {/* Historical Performance Summary (Closed Trades Engine) */}
      {(() => {
        const closedTrades = trades.filter((t) => t.status === "CLOSED" && t.closeTime);
        const totalClosed = closedTrades.length;
        const totalRealizedPnl = closedTrades.reduce((sum, t) => sum + (t.profit + (t.commission || 0) + (t.swap || 0)), 0);
        
        const todayStr = new Date().toISOString().split("T")[0];
        const profitTodayVal = closedTrades
          .filter((t) => t.closeTime && t.closeTime.startsWith(todayStr))
          .reduce((sum, t) => sum + (t.profit + (t.commission || 0) + (t.swap || 0)), 0);

        const currentMonthKey = new Date().toISOString().substring(0, 7); // "YYYY-MM"
        const monthlyTradesCount = closedTrades.filter((t) => t.closeTime && t.closeTime.startsWith(currentMonthKey)).length;

        const wins = closedTrades.filter((t) => (t.profit + (t.commission || 0) + (t.swap || 0)) >= 0);
        const losses = closedTrades.filter((t) => (t.profit + (t.commission || 0) + (t.swap || 0)) < 0);

        const winRate = totalClosed > 0 ? ((wins.length / totalClosed) * 100).toFixed(1) : "0.0";
        const grossProfit = wins.reduce((sum, t) => sum + (t.profit + (t.commission || 0) + (t.swap || 0)), 0);
        const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.profit + (t.commission || 0) + (t.swap || 0)), 0));
        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "MAX" : "0.00";

        const currencySymbol = selectedAccount.currency === "USC" ? "USC" : "$";

        return (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 font-mono">
            <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"}`}>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">HISTORICAL TOTAL P/L</span>
              <span className={`text-lg font-extrabold ${totalRealizedPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {totalRealizedPnl >= 0 ? "+" : ""}{currencySymbol}{totalRealizedPnl.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{totalClosed} closed trades</span>
            </div>

            <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"}`}>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">PROFIT TODAY</span>
              <span className={`text-lg font-extrabold ${profitTodayVal >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {profitTodayVal >= 0 ? "+" : ""}{currencySymbol}{profitTodayVal.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Closed today</span>
            </div>

            <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"}`}>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">MONTHLY TRADES</span>
              <span className="text-lg font-extrabold text-white">{monthlyTradesCount}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">This month ({currentMonthKey})</span>
            </div>

            <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"}`}>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">WIN RATE</span>
              <span className="text-lg font-extrabold text-white">{winRate}%</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{wins.length} W / {losses.length} L</span>
            </div>

            <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"}`}>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">PROFIT FACTOR</span>
              <span className="text-lg font-extrabold text-white">{profitFactor}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Gross W / Gross L</span>
            </div>
          </div>
        );
      })()}

      {/* Live Open Positions Section */}
      <div
        className={`p-5 sm:p-7 rounded-3xl border shadow-xl space-y-5 ${
          isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-sans tracking-tight flex items-center gap-2">
              <span>Currently Open Positions</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {openPositions.length} Active
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-sans">
              Live floating position metrics synchronized every 2 seconds from MT5
            </p>
          </div>
        </div>

        {openPositions.length === 0 ? (
          <div className="py-12 text-center space-y-2 font-mono text-xs text-slate-500 dark:text-gray-400 border border-dashed border-slate-200 dark:border-white/[0.08] rounded-2xl">
            <Server className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
            <p className="font-bold text-slate-700 dark:text-gray-300">No open positions currently active</p>
            <p className="text-[11px] text-slate-400">Open trades in MetaTrader 5 will appear here automatically within ~1-5 seconds</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr
                  className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                    isLight ? "border-slate-200 text-slate-500" : "border-white/[0.08] text-gray-400"
                  }`}
                >
                  <th className="py-3 px-3">Ticket</th>
                  <th className="py-3 px-3">Symbol</th>
                  <th className="py-3 px-3">Side</th>
                  <th className="py-3 px-3">Volume</th>
                  <th className="py-3 px-3">Open Price</th>
                  <th className="py-3 px-3">Current Price</th>
                  <th className="py-3 px-3">SL</th>
                  <th className="py-3 px-3">TP</th>
                  <th className="py-3 px-3">Swap</th>
                  <th className="py-3 px-3 text-right">Floating P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {openPositions.map((pos) => {
                  const isBuy = pos.side === "BUY";
                  const isProfit = pos.profit >= 0;

                  return (
                    <tr
                      key={pos.positionId}
                      className={`transition-colors ${
                        isLight ? "hover:bg-slate-50" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="py-3 px-3 font-bold text-slate-600 dark:text-gray-300">{pos.ticket}</td>
                      <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white">{pos.symbol}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isBuy
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {pos.side}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold">{pos.volume}</td>
                      <td className="py-3 px-3">{pos.openPrice}</td>
                      <td className="py-3 px-3 font-bold">{pos.currentPrice}</td>
                      <td className="py-3 px-3 text-slate-400">{pos.stopLoss ?? "—"}</td>
                      <td className="py-3 px-3 text-slate-400">{pos.takeProfit ?? "—"}</td>
                      <td className="py-3 px-3 text-slate-400">${pos.swap.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right font-extrabold">
                        <span className={isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {isProfit ? "+" : ""}${pos.profit.toFixed(2)}
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


      {/* Equity Chart Card */}
      <div
        className={`p-5 sm:p-7 rounded-3xl border shadow-xl space-y-5 ${
          isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-sans tracking-tight">Equity Curve</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-sans">
              Real-time portfolio equity trajectory across selected timeframes
            </p>
          </div>

          {/* Timeframe Controls */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] font-mono text-xs">
            {(["1H", "4H", "1D", "1W", "1M"] as MT5Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  timeframe === tf
                    ? isLight
                      ? "bg-white text-emerald-700 shadow-sm border border-slate-200"
                      : "bg-blue-600 text-white shadow-md"
                    : isLight
                    ? "text-slate-600 hover:text-slate-900"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Graph Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] font-mono text-xs">
          <div>
            <span className="text-slate-500 dark:text-gray-400 text-[10px] block">Starting Balance</span>
            <strong className="text-slate-900 dark:text-white font-bold">${equityData.startingBalance.toFixed(2)}</strong>
          </div>

          <div>
            <span className="text-slate-500 dark:text-gray-400 text-[10px] block">Current Equity</span>
            <strong className="text-emerald-600 dark:text-emerald-400 font-bold">${equityData.currentEquity.toFixed(2)}</strong>
          </div>

          <div>
            <span className="text-slate-500 dark:text-gray-400 text-[10px] block">High Peak</span>
            <strong className="text-slate-900 dark:text-white font-bold">${equityData.high.toFixed(2)}</strong>
          </div>

          <div>
            <span className="text-slate-500 dark:text-gray-400 text-[10px] block">Low Trough</span>
            <strong className="text-slate-900 dark:text-white font-bold">${equityData.low.toFixed(2)}</strong>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityData.points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="mt5EquityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isLight ? "#10B981" : "#3B82F6"} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={isLight ? "#10B981" : "#3B82F6"} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#E2E8F0" : "#ffffff10"} />
              <XAxis dataKey="timestamp" stroke={isLight ? "#64748B" : "#94A3B8"} fontSize={11} tickLine={false} />
              <YAxis domain={["auto", "auto"]} stroke={isLight ? "#64748B" : "#94A3B8"} fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isLight ? "#FFFFFF" : "#0F141C",
                  borderColor: isLight ? "#E2E8F0" : "#ffffff20",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={isLight ? "#10B981" : "#3B82F6"}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#mt5EquityGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Terminal Executions */}
      <div
        className={`p-5 sm:p-7 rounded-3xl border shadow-xl space-y-5 ${
          isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-sans tracking-tight">
              Recent Terminal Executions
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-sans">
              Latest order executions from MT5 account {selectedAccount.accountNumber}
            </p>
          </div>

          <Link
            href="/mt5/trades"
            className={`flex items-center gap-1.5 text-xs font-mono font-bold transition-colors ${
              isLight ? "text-emerald-700 hover:text-emerald-600" : "text-blue-400 hover:text-blue-300"
            }`}
          >
            View all trades <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr
                className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                  isLight ? "border-slate-200 text-slate-500" : "border-white/[0.08] text-gray-400"
                }`}
              >
                <th className="py-3 px-3">Time</th>
                <th className="py-3 px-3">Symbol</th>
                <th className="py-3 px-3">Side</th>
                <th className="py-3 px-3">Volume</th>
                <th className="py-3 px-3">Open Price</th>
                <th className="py-3 px-3">Net P/L</th>
                <th className="py-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {recentExecutions.map((t) => {
                const isBuy = t.side === "BUY";
                const isProfit = t.profit >= 0;
                const timeOnly = t.openTime.includes("T")
                  ? t.openTime.split("T")[1].split(".")[0]
                  : t.openTime;

                return (
                  <tr
                    key={t.ticket}
                    onClick={() => setSelectedTrade(t)}
                    className={`cursor-pointer transition-colors ${
                      isLight ? "hover:bg-slate-50" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="py-3 px-3 text-slate-500 dark:text-gray-400">{timeOnly}</td>
                    <td className="py-3 px-3 font-bold">{t.symbol}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isBuy
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {t.side}
                      </span>
                    </td>
                    <td className="py-3 px-3">{t.volume}</td>
                    <td className="py-3 px-3">{t.openPrice}</td>
                    <td className="py-3 px-3 font-bold">
                      <span className={isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {isProfit ? "+" : ""}${t.profit.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === "OPEN" ? "bg-amber-500/20 text-amber-600 dark:text-amber-300" : "bg-slate-500/10 text-slate-500 dark:text-gray-400"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade Detail Drawer */}
      <MT5TradeDetailDrawer
        trade={selectedTrade}
        account={selectedAccount}
        onClose={() => setSelectedTrade(null)}
      />
    </div>
  );
}
