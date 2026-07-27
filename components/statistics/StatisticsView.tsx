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
  Trophy, AlertTriangle, Activity, BarChart2, DollarSign, PieChart, RefreshCw
} from "lucide-react";

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

  // Compute analytics
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
              LIVE CLOUD METRICS
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Audited performance calculations from {analytics.totalTrades} closed positions in Supabase.
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

      {/* Overview Stat Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">NET PROFIT</span>
          <span className={`text-lg font-extrabold block ${analytics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatSigned(analytics.netProfit)}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">WIN RATE</span>
          <span className="text-lg font-extrabold text-purple-400 block">
            {analytics.winRate}%
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">PROFIT FACTOR</span>
          <span className="text-lg font-extrabold text-white block">
            {analytics.profitFactor}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">EXPECTANCY</span>
          <span className="text-lg font-extrabold text-emerald-400 block">
            {formatSigned(analytics.expectancy)}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">AVG RISK : REWARD</span>
          <span className="text-lg font-extrabold text-purple-300 block">
            {analytics.avgRR} R
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block">TOTAL VOLUME</span>
          <span className="text-lg font-extrabold text-gray-200 block">
            {analytics.totalVolume} Lots
          </span>
        </div>
      </div>

      {/* Superlative Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Most Profitable Instrument */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30 space-y-2">
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
        </div>

        {/* Biggest Losing Instrument */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 to-transparent border border-rose-500/30 space-y-2">
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
        </div>

        {/* Most Consistent Instrument */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/30 space-y-2">
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
        </div>

        {/* Best Session */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/30 space-y-2">
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

      {/* Long vs Short Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Long Positions Analysis */}
        <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-mono">LONG Executions</h3>
                <span className="text-xs text-gray-400 font-mono">{analytics.longTrades} trades</span>
              </div>
            </div>

            <span className="text-sm font-bold font-mono text-emerald-400">
              {analytics.longWinRate}% Win Rate
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-gray-400 block text-[10px]">TOTAL NET P&L</span>
              <span className={`font-bold text-sm ${analytics.longPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatSigned(analytics.longPnL)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-gray-400 block text-[10px]">WINS / LOSSES</span>
              <span className="text-white font-bold text-sm">
                {analytics.longWins}W / {analytics.longTrades - analytics.longWins}L
              </span>
            </div>
          </div>
        </div>

        {/* Short Positions Analysis */}
        <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-mono">SHORT Executions</h3>
                <span className="text-xs text-gray-400 font-mono">{analytics.shortTrades} trades</span>
              </div>
            </div>

            <span className="text-sm font-bold font-mono text-rose-400">
              {analytics.shortWinRate}% Win Rate
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-gray-400 block text-[10px]">TOTAL NET P&L</span>
              <span className={`font-bold text-sm ${analytics.shortPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatSigned(analytics.shortPnL)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-gray-400 block text-[10px]">WINS / LOSSES</span>
              <span className="text-white font-bold text-sm">
                {analytics.shortWins}W / {analytics.shortTrades - analytics.shortWins}L
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Institutional Symbol Performance Table */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            Institutional Symbol Analytics
          </h3>
          <span className="text-gray-400 text-[11px]">Click a symbol to inspect its trades</span>
        </div>

        <div className="rounded-xl border border-dark-border overflow-x-auto bg-dark-card/60">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#0C1019] text-gray-400 border-b border-dark-border">
              <tr>
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4">Trades</th>
                <th className="py-3 px-4">Win Rate %</th>
                <th className="py-3 px-4">Net PnL</th>
                <th className="py-3 px-4">Profit Factor</th>
                <th className="py-3 px-4">Avg R:R</th>
                <th className="py-3 px-4">Largest Win</th>
                <th className="py-3 px-4">Largest Loss</th>
                <th className="py-3 px-4">Long / Short</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border text-gray-300">
              {analytics.symbols.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
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
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <span>{s.symbol}</span>
                    </td>
                    <td className="py-3 px-4">{s.trades}</td>
                    <td className="py-3 px-4 text-purple-300 font-bold">{s.winRate}%</td>
                    <td className={`py-3 px-4 font-bold ${s.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatSigned(s.netProfit)}
                    </td>
                    <td className="py-3 px-4">{s.profitFactor}</td>
                    <td className="py-3 px-4 text-purple-400 font-bold">{s.avgRR}R</td>
                    <td className="py-3 px-4 text-emerald-400">{formatSigned(s.largestWin)}</td>
                    <td className="py-3 px-4 text-rose-400">{formatSigned(s.largestLoss)}</td>
                    <td className="py-3 px-4 text-gray-400">
                      {s.longTrades}L / {s.shortTrades}S
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Symbol Trades Modal / Drawer */}
      {selectedSymbol && (
        <div className="p-6 rounded-2xl bg-dark-card border border-purple-500/40 space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-purple-400" />
              Executions for {selectedSymbol} ({filteredSymbolTrades.length} trades)
            </h4>
            <button
              onClick={() => setSelectedSymbol(null)}
              className="text-gray-400 hover:text-white"
            >
              Close
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
