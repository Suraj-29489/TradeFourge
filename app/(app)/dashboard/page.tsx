"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useJournalMetrics } from "@/hooks/useJournalMetrics";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { StatCard } from "@/components/dashboard/StatCard";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProfile, calculateProfileCompletion, type UserProfile } from "@/lib/supabase/profile";
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
  Globe,
  Clock,
  User,
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
  const journals = useJournalStore((state) => state.journals);
  const selectedJournalIds = useJournalStore((state) => state.selectedJournalIds);

  const [profile, setProfile] = useState<UserProfile | null>(null);

  const { trades, stats } = useJournalMetrics();
  const { format, formatSigned, currency } = useCurrencyFormatter();
  const supabase = createClient();

  useEffect(() => {
    init();
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const prof = await fetchUserProfile(user.id);
          if (prof) setProfile(prof);
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      }
    }
    loadProfile();
  }, [init]);

  // Balance display — never estimate
  const balanceDisplay = accountBalance !== null
    ? format(accountBalance)
    : "Balance unavailable";

  const balanceIsKnown = accountBalance !== null;
  const completionPct = calculateProfileCompletion(profile);

  if (journals.length === 0 || selectedJournalIds.length === 0 || trades.length === 0) {
    return (
      <div className="max-w-3xl mx-auto my-12 p-8 md:p-12 rounded-3xl glass-card border border-dark-border text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-glow">
          <FileSpreadsheet className="w-10 h-10" />
        </div>

        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            No TradeFourge Journal Imported
          </h1>
          <p className="text-sm text-gray-400 max-w-md mx-auto mt-2">
            Import your Exness MT4 / MT5 position CSV file to unlock real-time financial analytics, equity curves, calendar heatmaps, and AI insights.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/upload"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-glow flex items-center justify-center gap-2 transition-all"
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
      {/* SaaS Live Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#111726] to-[#182238] border border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="relative group shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 p-0.5 shadow-glow overflow-hidden flex items-center justify-center">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <div className="w-full h-full rounded-xl bg-[#111726] flex items-center justify-center text-lg font-bold font-mono text-purple-400">
                  {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "T"}
                </div>
              )}
            </div>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight font-mono">
                Welcome back, {profile?.full_name || "Trader"}
              </h1>
              <span className="text-xs font-mono text-purple-400 font-bold">
                @{profile?.username || "trader"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-mono mt-1">
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-indigo-400" /> {profile?.country || "United States"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> {profile?.timezone || "UTC"}
              </span>
              <span>•</span>
              <span>{currency} Currency</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/profile" className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-gray-300 flex items-center gap-2 transition-all">
            <User className="w-3.5 h-3.5 text-purple-400" />
            <span>Profile {completionPct}%</span>
          </Link>

          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400 flex items-center gap-2 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{accountType} Terminal</span>
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
