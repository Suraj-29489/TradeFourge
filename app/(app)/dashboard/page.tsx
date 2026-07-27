"use client";
// app/(app)/dashboard/page.tsx
// Production TradeFourge Dashboard — High Information Density Terminal Experience
// Answers "How am I doing?" within 10 seconds via real cloud data & statistical insights.

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { format, parseISO } from "date-fns";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { useUserProfile } from "@/context/UserProfileContext";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades } from "@/lib/supabase/trades";
import { fetchLatestImport } from "@/lib/supabase/csv-imports";
import { calculateCloudAnalytics, CompleteAnalyticsSummary } from "@/lib/engine/cloud-analytics-engine";
import { AddTradeModal } from "@/components/trades/AddTradeModal";
import { CloudTradeDetailDrawer } from "@/components/trades/CloudTradeDetailDrawer";
import { TableSkeleton, StatGridSkeleton } from "@/components/ui/LoadingSkeleton";
import type { CloudTradeWithRelations, CsvImport } from "@/types/database";
import {
  Wallet, TrendingUp, TrendingDown, Zap, Target, Award, Clock, Globe, User,
  Upload, History, Plus, BarChart3, LineChart, Sparkles, AlertCircle, ArrowRight,
  ShieldCheck, RefreshCw, CheckCircle2, ChevronRight, Activity, Calendar
} from "lucide-react";

// Lazy load heavy chart components
const DashboardCharts = dynamic(
  () => import("@/components/dashboard/DashboardCharts").then((m) => ({ default: m.DashboardCharts })),
  { ssr: false, loading: () => <div className="h-72 rounded-2xl glass-card border border-dark-border animate-pulse" /> }
);

const TradeCalendar = dynamic(
  () => import("@/components/calendar/TradeCalendar").then((m) => ({ default: m.TradeCalendar })),
  { ssr: false, loading: () => <div className="h-72 rounded-2xl glass-card border border-dark-border animate-pulse" /> }
);

export default function DashboardPage() {
  const init = useJournalStore((state) => state.init);
  const { formatSigned } = useCurrencyFormatter();
  const supabase = createClient();

  const { profile, completionPct, defaultAccount, accounts } = useUserProfile();

  const [trades, setTrades] = useState<CloudTradeWithRelations[]>([]);
  const [latestImport, setLatestImport] = useState<CsvImport | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals & Drawers
  const [addTradeOpen, setAddTradeOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<CloudTradeWithRelations | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [tradesRes, impRes] = await Promise.all([
        fetchTrades(user.id, {}, 1, 5000, "close_time", false),
        fetchLatestImport(user.id),
      ]);

      if (tradesRes.data?.data) setTrades(tradesRes.data.data);
      if (impRes.data) setLatestImport(impRes.data);
    } catch (err) {
      console.error("Dashboard load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
    loadDashboardData();
  }, [init]);

  const analytics: CompleteAnalyticsSummary = useMemo(() => {
    return calculateCloudAnalytics(trades);
  }, [trades]);

  // Today's PnL calculation
  const todaysPnL = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return trades
      .filter((t) => (t.close_time || t.open_time || "").startsWith(todayStr))
      .reduce((sum, t) => sum + (t.net_profit ?? (t.profit + t.commission + t.swap)), 0);
  }, [trades]);

  const recentTrades = useMemo(() => trades.slice(0, 5), [trades]);

  if (loading) {
    return (
      <div className="space-y-6 font-mono text-xs">
        <div className="h-24 rounded-2xl glass-card border border-dark-border animate-pulse" />
        <StatGridSkeleton count={8} />
        <div className="h-72 rounded-2xl glass-card border border-dark-border animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5 text-xs font-mono">
      {/* ── Top Summary Header Strip ─────────────────────────────────────── */}
      <div className="p-5 rounded-2xl glass-card border border-dark-border flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xl">
        {/* User Info & Status */}
        <div className="flex items-center gap-3.5">
          <Link href="/profile" className="relative group shrink-0" title="View Trader Profile">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 p-0.5 shadow-glow flex items-center justify-center">
              <div className="w-full h-full rounded-lg bg-dark-bg flex items-center justify-center text-sm font-bold text-purple-400">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "T"}
              </div>
            </div>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-extrabold text-white tracking-tight">
                Dashboard Overview
              </h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase ${analytics.classification.color}`}>
                {analytics.classification.title}
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Welcome back, <strong className="text-white">{profile?.full_name || "Trader"}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1 text-indigo-400"><Globe className="w-3 h-3" /> {profile?.country || "US"}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400"><Clock className="w-3 h-3" /> {profile?.timezone || "UTC"}</span>
            </p>
          </div>
        </div>

        {/* Quick Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAddTradeOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-glow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Trade</span>
          </button>

          <Link
            href="/upload"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 font-bold transition-all"
          >
            <Upload className="w-3.5 h-3.5 text-purple-400" />
            <span>Upload CSV</span>
          </Link>

          <Link
            href="/accounts"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 font-bold transition-all"
          >
            <Wallet className="w-3.5 h-3.5 text-indigo-400" />
            <span>Accounts</span>
          </Link>

          <Link
            href="/performance"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 font-bold transition-all"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Performance Lab</span>
          </Link>
        </div>
      </div>

      {/* ── Key Performance Terminal Metrics Strip ────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Active Account */}
        <div className="p-3 rounded-xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">ACTIVE ACCOUNT</span>
          <span className="text-xs font-bold text-white block truncate">
            {defaultAccount?.account_name ?? "Default"}
          </span>
          <span className="text-[9px] text-purple-400 block">{defaultAccount?.broker || "Generic"}</span>
        </div>

        {/* Current Balance */}
        <div className="p-3 rounded-xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">BALANCE</span>
          <span className="text-sm font-extrabold text-white block">
            {defaultAccount?.currency || "USD"} {defaultAccount?.current_balance.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "0.00"}
          </span>
          <span className="text-[9px] text-gray-400 block">Equilibrium</span>
        </div>

        {/* Today's PnL */}
        <div className="p-3 rounded-xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">TODAY'S P&L</span>
          <span className={`text-sm font-extrabold block ${todaysPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatSigned(todaysPnL)}
          </span>
          <span className="text-[9px] text-gray-400 block">Closed Today</span>
        </div>

        {/* Total Net PnL */}
        <div className="p-3 rounded-xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">TOTAL NET P&L</span>
          <span className={`text-sm font-extrabold block ${analytics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatSigned(analytics.netProfit)}
          </span>
          <span className="text-[9px] text-gray-400 block">All-time</span>
        </div>

        {/* Win Rate */}
        <div className="p-3 rounded-xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">WIN RATE</span>
          <span className="text-sm font-extrabold text-purple-400 block">
            {analytics.winRate}%
          </span>
          <span className="text-[9px] text-gray-400 block">{analytics.wins}W / {analytics.losses}L</span>
        </div>

        {/* Profit Factor */}
        <div className="p-3 rounded-xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">PROFIT FACTOR</span>
          <span className="text-sm font-extrabold text-white block">
            {analytics.profitFactor}
          </span>
          <span className="text-[9px] text-gray-400 block">Expectancy: ${analytics.expectancy}</span>
        </div>

        {/* Profile Completion */}
        <div className="p-3 rounded-xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">PROFILE SETUP</span>
          <span className="text-sm font-extrabold text-emerald-400 block">
            {completionPct}%
          </span>
          <span className="text-[9px] text-gray-400 block">Verified</span>
        </div>

        {/* Last CSV Import */}
        <div className="p-3 rounded-xl bg-dark-card border border-dark-border space-y-1">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">LAST IMPORT</span>
          <span className="text-xs font-bold text-gray-200 block truncate">
            {latestImport?.filename || "None"}
          </span>
          <span className="text-[9px] text-gray-400 block">
            {latestImport?.uploaded_at ? format(parseISO(latestImport.uploaded_at), "MM/dd HH:mm") : "—"}
          </span>
        </div>
      </div>

      {/* ── Deterministic TradeFourge Intelligence Banner ────────────────────── */}
      {analytics.insights.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border border-purple-500/30 space-y-2">
          <div className="flex items-center gap-2 text-purple-400 font-bold uppercase tracking-wider text-[11px]">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Deterministic Trade Intelligence</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-200">
            {analytics.insights.map((ins, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-black/30 border border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                <span>{ins}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Charts & Intelligence Grid ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Compact Equity Curve & Charts */}
        <div className="lg:col-span-2 space-y-5">
          <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <LineChart className="w-4 h-4 text-purple-400" />
                Performance Overview & Cumulative Equity Curve
              </h2>
              <Link href="/performance" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-bold">
                Detailed Analysis <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <DashboardCharts />
          </div>

          {/* Calendar Heatmap Preview */}
          <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                Trading Calendar & Heatmap
              </h2>
              <Link href="/calendar" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-bold">
                Full Calendar <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <TradeCalendar />
          </div>
        </div>

        {/* Right Col: Trading Intelligence Superlatives & Recent Activity */}
        <div className="space-y-5">
          {/* Quick Superlatives Card */}
          <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
            <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2 border-b border-dark-border pb-3">
              <Target className="w-4 h-4 text-purple-400" />
              Intelligence Superlatives
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 rounded-xl bg-dark-card border border-dark-border">
                <span className="text-gray-400">Best Instrument:</span>
                <span className="text-emerald-400 font-bold">{analytics.bestSymbol?.symbol || "N/A"} ({analytics.bestSymbol ? formatSigned(analytics.bestSymbol.netProfit) : "$0"})</span>
              </div>

              <div className="flex justify-between p-2 rounded-xl bg-dark-card border border-dark-border">
                <span className="text-gray-400">Worst Instrument:</span>
                <span className="text-rose-400 font-bold">{analytics.worstSymbol?.symbol || "N/A"} ({analytics.worstSymbol ? formatSigned(analytics.worstSymbol.netProfit) : "$0"})</span>
              </div>

              <div className="flex justify-between p-2 rounded-xl bg-dark-card border border-dark-border">
                <span className="text-gray-400">Best Day of Week:</span>
                <span className="text-white font-bold">{analytics.bestDay?.period || "N/A"}</span>
              </div>

              <div className="flex justify-between p-2 rounded-xl bg-dark-card border border-dark-border">
                <span className="text-gray-400">Peak Trading Hour:</span>
                <span className="text-indigo-400 font-bold">{analytics.bestHour?.period || "N/A"}</span>
              </div>

              <div className="flex justify-between p-2 rounded-xl bg-dark-card border border-dark-border">
                <span className="text-gray-400">Highest WR Symbol:</span>
                <span className="text-purple-300 font-bold">{analytics.highestWinRateSymbol?.symbol || "N/A"} ({analytics.highestWinRateSymbol?.winRate || 0}%)</span>
              </div>

              <div className="flex justify-between p-2 rounded-xl bg-dark-card border border-dark-border">
                <span className="text-gray-400">Largest Win:</span>
                <span className="text-emerald-400 font-bold">{formatSigned(analytics.largestWin)}</span>
              </div>

              <div className="flex justify-between p-2 rounded-xl bg-dark-card border border-dark-border">
                <span className="text-gray-400">Largest Loss:</span>
                <span className="text-rose-400 font-bold">{formatSigned(analytics.largestLoss)}</span>
              </div>
            </div>
          </div>

          {/* Recent Closed Trades List */}
          <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                Recent Activity
              </h2>
              <Link href="/journal" className="text-xs text-purple-400 hover:text-purple-300 font-bold">
                View Journal →
              </Link>
            </div>

            <div className="space-y-2">
              {recentTrades.length === 0 ? (
                <p className="text-gray-500 text-xs py-4 text-center">No trades logged yet.</p>
              ) : (
                recentTrades.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTrade(t)}
                    className="p-2.5 rounded-xl bg-dark-card border border-dark-border hover:border-purple-500/40 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{t.symbol}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          t.side === "BUY" || t.side === "LONG" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        }`}>
                          {t.side} {t.volume}L
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 block">
                        {t.close_time ? format(parseISO(t.close_time), "MM/dd HH:mm") : "—"}
                      </span>
                    </div>
                    <span className={`font-bold ${t.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatSigned(t.net_profit)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Trade Modal */}
      {addTradeOpen && (
        <AddTradeModal
          isOpen={addTradeOpen}
          onClose={() => setAddTradeOpen(false)}
          onSuccess={() => {
            setAddTradeOpen(false);
            loadDashboardData();
          }}
        />
      )}

      {/* Cloud Trade Detail Drawer */}
      {selectedTrade && (
        <CloudTradeDetailDrawer
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onRefresh={() => {
            setSelectedTrade(null);
            loadDashboardData();
          }}
        />
      )}
    </div>
  );
}
