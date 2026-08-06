"use client";

import React from "react";
import { useCompanionAccount } from "@/context/CompanionAccountContext";
import { BarChart3, TrendingUp, Award, Target, Zap, ShieldCheck } from "lucide-react";

export const CompanionAnalyticsView: React.FC = () => {
  const { currentAccount } = useCompanionAccount();
  const stats = currentAccount?.stats;

  return (
    <div className="space-y-6 font-mono text-xs max-w-7xl mx-auto w-full text-gray-200 pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight font-sans flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <span>Companion Performance Analytics</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-sans">
            Institutional performance breakdown for {currentAccount?.broker || "Companion"} ({currentAccount?.accountNumber || "1001"})
          </p>
        </div>

        <div className="px-3.5 py-2 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-400 font-bold text-xs">
          ● Synced Metrics
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Win Rate */}
        <div className="p-5 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-1 shadow-sm">
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Win Rate</span>
          <p className="text-xl font-extrabold text-emerald-400 font-mono">
            {stats?.winRate ?? 0}%
          </p>
          <span className="text-[10px] text-gray-500 block">
            {stats?.winningTrades ?? 0} W / {stats?.losingTrades ?? 0} L
          </span>
        </div>

        {/* Card 2: Net PnL */}
        <div className="p-5 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-1 shadow-sm">
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Net PnL</span>
          <p className={`text-xl font-extrabold font-mono ${(stats?.netPnL ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {(stats?.netPnL ?? 0) >= 0 ? "+" : ""}${(stats?.netPnL ?? 0).toFixed(2)}
          </p>
          <span className="text-[10px] text-gray-500 block">Realized Growth</span>
        </div>

        {/* Card 3: Profit Factor */}
        <div className="p-5 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-1 shadow-sm">
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Profit Factor</span>
          <p className="text-xl font-extrabold text-white font-mono">
            {stats?.profitFactor ?? 0}
          </p>
          <span className="text-[10px] text-gray-500 block">Gross Profit / Gross Loss</span>
        </div>

        {/* Card 4: Max Drawdown */}
        <div className="p-5 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-1 shadow-sm">
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Max Drawdown</span>
          <p className="text-xl font-extrabold text-rose-400 font-mono">
            {stats?.maxDrawdownPct ?? 0}%
          </p>
          <span className="text-[10px] text-gray-500 block">Peak-to-Trough Decline</span>
        </div>

        {/* Card 5: Average R:R */}
        <div className="p-5 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-1 shadow-sm">
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Average R:R</span>
          <p className="text-xl font-extrabold text-blue-400 font-mono">
            1:{stats?.averageRR ?? 0}
          </p>
          <span className="text-[10px] text-gray-500 block">Expectancy Multiplier</span>
        </div>
      </div>
    </div>
  );
};
