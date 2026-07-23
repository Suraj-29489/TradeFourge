"use client";

import React from "react";
import { useJournalMetrics } from "@/hooks/useJournalMetrics";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { getEngineSymbolPerformance } from "@/lib/engine/statistics-engine";
import { Zap, TrendingUp, TrendingDown, Target, Award, Clock, Layers } from "lucide-react";

export const StatisticsView: React.FC = () => {
  const { filteredTrades, stats } = useJournalMetrics();
  const { format: formatCurrency, currency } = useCurrencyFormatter();

  const symbolPerf = getEngineSymbolPerformance(filteredTrades);

  const longTrades = filteredTrades.filter((t) => t.direction === "LONG");
  const shortTrades = filteredTrades.filter((t) => t.direction === "SHORT");

  const longWins = longTrades.filter((t) => t.profit > 0).length;
  const shortWins = shortTrades.filter((t) => t.profit > 0).length;

  const longWinRate = longTrades.length > 0 ? (longWins / longTrades.length) * 100 : 0;
  const shortWinRate = shortTrades.length > 0 ? (shortWins / shortTrades.length) * 100 : 0;

  const longPnL = longTrades.reduce((acc, t) => acc + t.profit, 0);
  const shortPnL = shortTrades.reduce((acc, t) => acc + t.profit, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Quantitative Statistics & Analytics
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
              AUDITED METRICS
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Calculated dynamically from {filteredTrades.length} position records ({currency})
          </p>
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
                <span className="text-xs text-gray-400 font-mono">{longTrades.length} trades</span>
              </div>
            </div>

            <span className="text-sm font-bold font-mono text-emerald-400">
              {longWinRate.toFixed(1)}% Win Rate
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
            <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-gray-400 block text-[10px]">TOTAL NET P&L</span>
              <span className={`font-bold text-sm ${longPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {longPnL >= 0 ? "+" : ""}{formatCurrency(longPnL)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-gray-400 block text-[10px]">WINS / LOSSES</span>
              <span className="text-white font-bold text-sm">
                {longWins}W / {longTrades.length - longWins}L
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
                <span className="text-xs text-gray-400 font-mono">{shortTrades.length} trades</span>
              </div>
            </div>

            <span className="text-sm font-bold font-mono text-rose-400">
              {shortWinRate.toFixed(1)}% Win Rate
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
            <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-gray-400 block text-[10px]">TOTAL NET P&L</span>
              <span className={`font-bold text-sm ${shortPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {shortPnL >= 0 ? "+" : ""}{formatCurrency(shortPnL)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-gray-400 block text-[10px]">WINS / LOSSES</span>
              <span className="text-white font-bold text-sm">
                {shortWins}W / {shortTrades.length - shortWins}L
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Symbol Breakdown Table */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-4">
        <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
          <Zap className="w-4 h-4 text-brand-400" />
          Instrument Performance Breakdown
        </h3>

        <div className="rounded-xl border border-dark-border overflow-hidden bg-dark-bg/60">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#0C1019] text-gray-400 border-b border-dark-border">
              <tr>
                <th className="py-2.5 px-4">Symbol</th>
                <th className="py-2.5 px-4">Trades</th>
                <th className="py-2.5 px-4">Win Rate %</th>
                <th className="py-2.5 px-4">Wins / Losses</th>
                <th className="py-2.5 px-4">Net PnL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border text-gray-300">
              {symbolPerf.map((s) => (
                <tr key={s.symbol} className="hover:bg-dark-hover/40 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-white">{s.symbol}</td>
                  <td className="py-2.5 px-4">{s.trades}</td>
                  <td className="py-2.5 px-4 text-brand-300 font-bold">{s.winRate}%</td>
                  <td className="py-2.5 px-4">
                    <span className="text-emerald-400">{s.wins}W</span> / <span className="text-rose-400">{s.losses}L</span>
                  </td>
                  <td className={`py-2.5 px-4 font-bold ${s.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {s.pnl >= 0 ? "+" : ""}{formatCurrency(s.pnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
