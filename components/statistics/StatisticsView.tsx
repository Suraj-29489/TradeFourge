"use client";
// components/statistics/StatisticsView.tsx
// Institutional Quantitative Statistics & Performance Analytics View
// Reads live CloudTrade data directly from Supabase and processes via cloud-analytics-engine.ts

import React, { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades } from "@/lib/supabase/trades";
import { calculateCloudAnalytics, CompleteAnalyticsSummary, SymbolPerformance } from "@/lib/engine/cloud-analytics-engine";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import type { CloudTradeWithRelations } from "@/types/database";
import {
  Zap, TrendingUp, TrendingDown, Target, Award, Clock, Layers, ShieldCheck,
  Trophy, AlertTriangle, Activity, BarChart2, DollarSign, PieChart, RefreshCw,
  Sparkles, Calendar, HelpCircle
} from "lucide-react";

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "N/A";
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m`;
  return `${seconds}s`;
}

export const StatisticsView: React.FC = () => {
  const { format: fmtCurrency, formatSigned } = useCurrencyFormatter();
  const supabase = createClient();

  const [trades, setTrades] = useState<CloudTradeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await fetchTrades(user.id, {}, 1, 10000, "close_time", false);
      if (data?.data) {
        setTrades(data.data);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const analytics: CompleteAnalyticsSummary = useMemo(() => {
    return calculateCloudAnalytics(trades);
  }, [trades]);

  const filteredSymbolTrades = useMemo(() => {
    if (!selectedSymbol) return [];
    return trades.filter(t => t.symbol.toUpperCase() === selectedSymbol.toUpperCase());
  }, [selectedSymbol, trades]);

  if (loading) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs font-mono">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Quantitative Performance Lab
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
              INSTITUTIONAL METRICS
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Audited statistical analytics from {analytics.totalTrades} closed positions in Supabase.
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2.5 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-hover text-gray-300 flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-purple-400" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Trader Classification Banner */}
      <div className={`p-6 rounded-2xl border ${analytics.classification.color} flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border">
              {analytics.classification.badge}
            </span>
            <h3 className="text-lg font-extrabold text-white tracking-tight">
              Trader Profile: {analytics.classification.title}
            </h3>
          </div>
          <p className="text-xs text-gray-300 max-w-2xl">
            {analytics.classification.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 shrink-0 text-right">
          <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
            <span className="text-gray-400 block text-[10px]">PROFIT FACTOR</span>
            <span className="text-white font-extrabold text-sm">{analytics.profitFactor}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
            <span className="text-gray-400 block text-[10px]">AVG HOLD TIME</span>
            <span className="text-purple-300 font-extrabold text-sm">{formatDuration(analytics.avgHoldSeconds)}</span>
          </div>
        </div>
      </div>

      {/* Primary Overview Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
        <div className="p-3.5 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">NET PROFIT</span>
          <span className={`text-base font-extrabold block ${analytics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatSigned(analytics.netProfit)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">WIN RATE</span>
          <span className="text-base font-extrabold text-purple-400 block">
            {analytics.winRate}%
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">PROFIT FACTOR</span>
          <span className="text-base font-extrabold text-white block">
            {analytics.profitFactor}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">EXPECTANCY</span>
          <span className="text-base font-extrabold text-emerald-400 block">
            {formatSigned(analytics.expectancy)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">AVG RISK : REWARD</span>
          <span className="text-base font-extrabold text-purple-300 block">
            {analytics.avgRR} R
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">AVG LOT SIZE</span>
          <span className="text-base font-extrabold text-gray-200 block">
            {analytics.avgLotSize} Lots
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">AVG DAILY P&L</span>
          <span className={`text-base font-extrabold block ${analytics.avgDailyProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatSigned(analytics.avgDailyProfit)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">TOTAL VOLUME</span>
          <span className="text-base font-extrabold text-gray-200 block">
            {analytics.totalVolume} Lots
          </span>
        </div>
      </div>

      {/* Superlative Highlight Cards with Hover Statistics Popups */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Most Profitable Instrument */}
        <div
          onClick={() => analytics.bestSymbol && setSelectedSymbol(analytics.bestSymbol.symbol)}
          className="relative group p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30 space-y-2 cursor-pointer transition-all hover:border-emerald-500"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" /> Best Instrument
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
              TOP GAINER
            </span>
          </div>
          {analytics.bestSymbol ? (
            <div>
              <p className="text-xl font-extrabold text-white">{analytics.bestSymbol.symbol}</p>
              <p className="text-xs text-emerald-400 font-bold">{formatSigned(analytics.bestSymbol.netProfit)} ({analytics.bestSymbol.winRate}% WR)</p>
            </div>
          ) : (
            <p className="text-gray-500 text-xs">No trades logged</p>
          )}

          {/* Hover Popover */}
          {analytics.bestSymbol && (
            <div className="absolute left-0 top-full mt-2 z-30 hidden group-hover:block w-64 p-3 rounded-xl bg-[#0F1420] border border-emerald-500/40 shadow-2xl space-y-1 text-[11px]">
              <span className="font-bold text-white block border-b border-white/10 pb-1">{analytics.bestSymbol.symbol} Quick Stats</span>
              <div className="flex justify-between text-gray-400"><span>Trades:</span><span className="text-white font-bold">{analytics.bestSymbol.trades}</span></div>
              <div className="flex justify-between text-gray-400"><span>Net Profit:</span><span className="text-emerald-400 font-bold">{formatSigned(analytics.bestSymbol.netProfit)}</span></div>
              <div className="flex justify-between text-gray-400"><span>Win Rate:</span><span className="text-purple-300 font-bold">{analytics.bestSymbol.winRate}%</span></div>
              <div className="flex justify-between text-gray-400"><span>Profit Factor:</span><span className="text-white font-bold">{analytics.bestSymbol.profitFactor}</span></div>
              <div className="flex justify-between text-gray-400"><span>Avg R:R:</span><span className="text-purple-400 font-bold">{analytics.bestSymbol.avgRR}R</span></div>
              <div className="flex justify-between text-gray-400"><span>Avg Lot Size:</span><span className="text-white font-bold">{analytics.bestSymbol.avgLotSize} Lots</span></div>
            </div>
          )}
        </div>

        {/* Biggest Losing Instrument */}
        <div
          onClick={() => analytics.worstSymbol && setSelectedSymbol(analytics.worstSymbol.symbol)}
          className="relative group p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 to-transparent border border-rose-500/30 space-y-2 cursor-pointer transition-all hover:border-rose-500"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Biggest Loser
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
              NEED REVIEW
            </span>
          </div>
          {analytics.worstSymbol ? (
            <div>
              <p className="text-xl font-extrabold text-white">{analytics.worstSymbol.symbol}</p>
              <p className="text-xs text-rose-400 font-bold">{formatSigned(analytics.worstSymbol.netProfit)} ({analytics.worstSymbol.winRate}% WR)</p>
            </div>
          ) : (
            <p className="text-gray-500 text-xs">No trades logged</p>
          )}

          {/* Hover Popover */}
          {analytics.worstSymbol && (
            <div className="absolute left-0 top-full mt-2 z-30 hidden group-hover:block w-64 p-3 rounded-xl bg-[#0F1420] border border-rose-500/40 shadow-2xl space-y-1 text-[11px]">
              <span className="font-bold text-white block border-b border-white/10 pb-1">{analytics.worstSymbol.symbol} Quick Stats</span>
              <div className="flex justify-between text-gray-400"><span>Trades:</span><span className="text-white font-bold">{analytics.worstSymbol.trades}</span></div>
              <div className="flex justify-between text-gray-400"><span>Net Profit:</span><span className="text-rose-400 font-bold">{formatSigned(analytics.worstSymbol.netProfit)}</span></div>
              <div className="flex justify-between text-gray-400"><span>Largest Loss:</span><span className="text-rose-400 font-bold">{formatSigned(analytics.worstSymbol.largestLoss)}</span></div>
              <div className="flex justify-between text-gray-400"><span>Win Rate:</span><span className="text-purple-300 font-bold">{analytics.worstSymbol.winRate}%</span></div>
            </div>
          )}
        </div>

        {/* Most Consistent Instrument */}
        <div
          onClick={() => analytics.mostConsistentSymbol && setSelectedSymbol(analytics.mostConsistentSymbol.symbol)}
          className="relative group p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/30 space-y-2 cursor-pointer transition-all hover:border-purple-500"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Target className="w-3.5 h-3.5" /> Most Consistent
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
              HIGHEST WR
            </span>
          </div>
          {analytics.mostConsistentSymbol ? (
            <div>
              <p className="text-xl font-extrabold text-white">{analytics.mostConsistentSymbol.symbol}</p>
              <p className="text-xs text-purple-300 font-bold">{analytics.mostConsistentSymbol.winRate}% Win Rate ({analytics.mostConsistentSymbol.trades} Trades)</p>
            </div>
          ) : (
            <p className="text-gray-500 text-xs">No trades logged</p>
          )}

          {/* Hover Popover */}
          {analytics.mostConsistentSymbol && (
            <div className="absolute left-0 top-full mt-2 z-30 hidden group-hover:block w-64 p-3 rounded-xl bg-[#0F1420] border border-purple-500/40 shadow-2xl space-y-1 text-[11px]">
              <span className="font-bold text-white block border-b border-white/10 pb-1">{analytics.mostConsistentSymbol.symbol} Consistency</span>
              <div className="flex justify-between text-gray-400"><span>Win Rate:</span><span className="text-purple-300 font-bold">{analytics.mostConsistentSymbol.winRate}%</span></div>
              <div className="flex justify-between text-gray-400"><span>Wins/Losses:</span><span className="text-white font-bold">{analytics.mostConsistentSymbol.wins}W / {analytics.mostConsistentSymbol.losses}L</span></div>
              <div className="flex justify-between text-gray-400"><span>Profit Factor:</span><span className="text-white font-bold">{analytics.mostConsistentSymbol.profitFactor}</span></div>
            </div>
          )}
        </div>

        {/* Best Session / Hour */}
        <div className="relative group p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Best Hour / Time
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
              PEAK HOUR
            </span>
          </div>
          {analytics.bestHour ? (
            <div>
              <p className="text-xl font-extrabold text-white">{analytics.bestHour.period}</p>
              <p className="text-xs text-indigo-300 font-bold">{formatSigned(analytics.bestHour.netProfit)} ({analytics.bestHour.trades} Trades)</p>
            </div>
          ) : (
            <p className="text-gray-500 text-xs">No trades logged</p>
          )}
        </div>
      </div>

      {/* Expanded Institutional Symbol Performance Table */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            Expanded Symbol Performance Breakdown
          </h3>
          <span className="text-gray-400 text-[11px]">Click a symbol row to inspect its trade log</span>
        </div>

        <div className="rounded-xl border border-dark-border overflow-x-auto bg-dark-card/60">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#0C1019] text-gray-400 border-b border-dark-border">
              <tr>
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4">Trades</th>
                <th className="py-3 px-4">Win Rate %</th>
                <th className="py-3 px-4">Net PnL</th>
                <th className="py-3 px-4">Gross Profit</th>
                <th className="py-3 px-4">Gross Loss</th>
                <th className="py-3 px-4">Profit Factor</th>
                <th className="py-3 px-4">Avg R:R</th>
                <th className="py-3 px-4">Largest Win</th>
                <th className="py-3 px-4">Largest Loss</th>
                <th className="py-3 px-4">Avg Lot Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border text-gray-300">
              {analytics.symbols.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-gray-500">
                    No trade symbols found in cloud journal.
                  </td>
                </tr>
              ) : (
                analytics.symbols.map((s) => (
                  <tr
                    key={s.symbol}
                    onClick={() => setSelectedSymbol(selectedSymbol === s.symbol ? null : s.symbol)}
                    className={`hover:bg-purple-600/10 cursor-pointer transition-colors ${
                      selectedSymbol === s.symbol ? "bg-purple-600/15 border-l-2 border-purple-500" : ""
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-white">{s.symbol}</td>
                    <td className="py-3 px-4">{s.trades}</td>
                    <td className="py-3 px-4 text-purple-300 font-bold">{s.winRate}%</td>
                    <td className={`py-3 px-4 font-bold ${s.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatSigned(s.netProfit)}
                    </td>
                    <td className="py-3 px-4 text-emerald-400">{formatSigned(s.grossProfit)}</td>
                    <td className="py-3 px-4 text-rose-400">{formatSigned(s.grossLoss)}</td>
                    <td className="py-3 px-4">{s.profitFactor}</td>
                    <td className="py-3 px-4 text-purple-400 font-bold">{s.avgRR}R</td>
                    <td className="py-3 px-4 text-emerald-400">{formatSigned(s.largestWin)}</td>
                    <td className="py-3 px-4 text-rose-400">{formatSigned(s.largestLoss)}</td>
                    <td className="py-3 px-4 text-gray-300">{s.avgLotSize} Lots</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Symbol Trades Explorer */}
      {selectedSymbol && (
        <div className="p-6 rounded-2xl bg-dark-card border border-purple-500/40 space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-purple-400" />
              Executions Explorer for {selectedSymbol} ({filteredSymbolTrades.length} trades)
            </h4>
            <button
              onClick={() => setSelectedSymbol(null)}
              className="text-gray-400 hover:text-white"
            >
              Close Explorer
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {filteredSymbolTrades.map((t) => (
              <div key={t.id} className="p-3 rounded-xl bg-dark-bg border border-dark-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.side === "BUY" || t.side === "LONG" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {t.side}
                  </span>
                  <span className="text-white font-bold">{t.volume} Lot</span>
                  <span className="text-gray-400 text-[11px]">Ticket #{t.ticket || t.id.slice(0, 6)}</span>
                </div>
                <span className={`font-bold ${t.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatSigned(t.net_profit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
