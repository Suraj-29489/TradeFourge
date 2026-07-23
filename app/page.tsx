"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useJournalMetrics } from "@/hooks/useJournalMetrics";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  Zap,
  Target,
  Award,
  ShieldCheck,
  Activity,
  Layers,
  Flame,
  Upload,
  Play,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";

// Lazy-load heavy charts — only renders after hydration
const DashboardCharts = dynamic(
  () => import("@/components/dashboard/DashboardCharts").then((m) => ({ default: m.DashboardCharts })),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl glass-card border border-dark-border animate-pulse" /> }
);

export default function DashboardPage() {
  const init = useJournalStore((state) => state.init);
  const loadDemoJournal = useJournalStore((state) => state.loadDemoJournal);
  const accountType = useJournalStore((state) => state.accountType);
  const accountBalance = useJournalStore((state) => state.accountBalance);

  const { trades, stats } = useJournalMetrics();
  const { format, formatSigned, currency } = useCurrencyFormatter();

  useEffect(() => {
    init();
  }, [init]);

  // Balance display — never estimate
  const balanceDisplay = accountBalance !== null
    ? format(accountBalance)
    : "Balance unavailable";

  const balanceIsKnown = accountBalance !== null;

  if (trades.length === 0) {
    return (
      <div className="max-w-3xl mx-auto my-12 p-8 md:p-12 rounded-3xl glass-card border border-dark-border text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-brand-600/20 border border-brand-500/30 text-brand-400 flex items-center justify-center shadow-glow">
          <FileSpreadsheet className="w-10 h-10" />
        </div>

        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            No Trading Journal Imported
          </h1>
          <p className="text-sm text-gray-400 max-w-md mx-auto mt-2">
            Import your Exness MT4 / MT5 position CSV file to unlock real-time financial analytics, equity curves, calendar heatmaps, and stats.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/upload"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-glow flex items-center justify-center gap-2 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Trading CSV</span>
          </Link>

          <button
            onClick={() => loadDemoJournal()}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 font-bold text-sm flex items-center justify-center gap-2 transition-all"
          >
            <Play className="w-4 h-4 text-emerald-400" />
            <span>Load Demo Journal</span>
          </button>
        </div>

        <div className="pt-6 border-t border-dark-border grid grid-cols-3 gap-4 text-xs font-mono text-gray-400">
          <div>✓ Client-Side Storage</div>
          <div>✓ Multi-Currency</div>
          <div>✓ PDF / Excel Export</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-dark-border">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight gradient-text">
            Trading Terminal Overview
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time trade performance metrics, risk ratios, and equity growth analytics ({currency})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-dark-card border border-dark-border text-xs font-mono text-gray-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{accountType} Account</span>
          </div>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Daily P&L"
          value={formatSigned(stats.dailyPnL)}
          icon={DollarSign}
          variant={stats.dailyPnL >= 0 ? "profit" : "loss"}
          trend={stats.dailyPnL >= 0 ? "up" : "down"}
          trendValue="Today"
        />

        <StatCard
          title="Weekly P&L"
          value={formatSigned(stats.weeklyPnL)}
          icon={TrendingUp}
          variant={stats.weeklyPnL >= 0 ? "profit" : "loss"}
          trend={stats.weeklyPnL >= 0 ? "up" : "down"}
          trendValue="This Week"
        />

        <StatCard
          title="Monthly P&L"
          value={formatSigned(stats.monthlyPnL)}
          icon={Activity}
          variant={stats.monthlyPnL >= 0 ? "profit" : "loss"}
          trend={stats.monthlyPnL >= 0 ? "up" : "down"}
          trendValue="This Month"
        />

        <StatCard
          title="Net Profit"
          value={formatSigned(stats.netProfit)}
          icon={Zap}
          variant={stats.netProfit >= 0 ? "profit" : "loss"}
          trend={stats.netProfit >= 0 ? "up" : "down"}
          trendValue="All Time"
        />

        <StatCard
          title="Account Balance"
          value={balanceDisplay}
          icon={ShieldCheck}
          variant={balanceIsKnown ? "brand" : "default"}
          subtitle={balanceIsKnown ? "From CSV equity" : "CSV has no equity column"}
        />

        <StatCard
          title="Win Rate"
          value={`${stats.winRate}%`}
          icon={Percent}
          variant={stats.winRate >= 50 ? "profit" : "loss"}
          trend={stats.winRate >= 50 ? "up" : "down"}
          trendValue={`${stats.winningTrades}W / ${stats.losingTrades}L`}
        />
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          title="Profit Factor"
          value={stats.profitFactor}
          icon={Target}
          variant="default"
          subtitle="Gross W / L Ratio"
        />

        <StatCard
          title="Average RR"
          value={stats.averageRR !== null ? `${stats.averageRR} R` : "N/A"}
          icon={Award}
          variant="brand"
          subtitle="Risk vs Reward"
        />

        <StatCard
          title="Average Win"
          value={format(stats.averageWin)}
          icon={CheckCircle2}
          variant="profit"
        />

        <StatCard
          title="Average Loss"
          value={format(stats.averageLoss)}
          icon={XCircle}
          variant="loss"
        />

        <StatCard
          title="Largest Win"
          value={format(stats.largestWin)}
          icon={TrendingUp}
          variant="profit"
        />

        <StatCard
          title="Largest Loss"
          value={format(stats.largestLoss)}
          icon={TrendingDown}
          variant="loss"
        />

        <StatCard
          title="Current Streak"
          value={
            stats.currentStreak.type === "NONE"
              ? "0"
              : `${stats.currentStreak.count} ${stats.currentStreak.type}`
          }
          icon={Flame}
          variant={
            stats.currentStreak.type === "WIN"
              ? "profit"
              : stats.currentStreak.type === "LOSS"
              ? "loss"
              : "default"
          }
        />

        <StatCard
          title="Best Streak"
          value={`${stats.bestStreak} Wins`}
          icon={Flame}
          variant="profit"
        />

        <StatCard
          title="Total Trades"
          value={stats.totalTrades}
          icon={Layers}
          variant="default"
        />

        <StatCard
          title="Winning Trades"
          value={stats.winningTrades}
          icon={CheckCircle2}
          variant="profit"
        />

        <StatCard
          title="Losing Trades"
          value={stats.losingTrades}
          icon={XCircle}
          variant="loss"
        />

        <StatCard
          title="Breakeven Trades"
          value={stats.breakevenCount}
          icon={MinusCircle}
          variant="default"
        />
      </div>

      {/* Main Charts Dashboard — lazy loaded */}
      <DashboardCharts />
    </div>
  );
}
