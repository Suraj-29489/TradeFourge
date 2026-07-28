"use client";
// app/(app)/dashboard/page.tsx
// TradeFourge Phase 3.2.2 — Interactive Premium Dashboard Experience & Regression Recovery
// Information-dense situational awareness terminal with rich hover tooltips, click navigation, and micro-interactions.

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO, subDays } from "date-fns";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { useUserProfile } from "@/context/UserProfileContext";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades } from "@/lib/supabase/trades";
import { fetchLatestImport } from "@/lib/supabase/csv-imports";
import { useAppEventListener } from "@/lib/events/event-bus";
import { calculateCloudAnalytics, CompleteAnalyticsSummary } from "@/lib/engine/cloud-analytics-engine";
import { CloudTradeDetailDrawer } from "@/components/trades/CloudTradeDetailDrawer";
import { StatGridSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CloudTradeWithRelations, CsvImport } from "@/types/database";
import {
  Wallet, TrendingUp, TrendingDown, Zap, Target, Award, Clock, Globe,
  Upload, History, Plus, BarChart3, LineChart, Sparkles, ArrowRight,
  ChevronRight, Activity, Calendar, TableProperties, ShieldCheck, Flame, AlertCircle, Info, ExternalLink
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

type TimeRange = "7D" | "30D" | "90D" | "ALL";

export default function DashboardPage() {
  const router = useRouter();
  const init = useJournalStore((state) => state.init);
  const theme = useJournalStore((state) => state.theme);
  const { formatSigned, currency } = useCurrencyFormatter();
  const supabase = createClient();

  const { profile, defaultAccount, accounts, switchDefaultAccount } = useUserProfile();

  const [trades, setTrades] = useState<CloudTradeWithRelations[]>([]);
  const [latestImport, setLatestImport] = useState<CsvImport | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30D");

  // Account Switcher Dropdown
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  // Selected Trade Drawer
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

      const fetchedTrades = tradesRes.data?.data ?? [];
      setTrades(fetchedTrades);
      setLatestImport(impRes.data ?? null);

      if (process.env.NODE_ENV !== "production") {
        console.log(`[TradeFourge Dev Log] Dashboard refresh completed. Active trade count: ${fetchedTrades.length}`);
      }
    } catch (err) {
      console.error("Dashboard load failed:", err);
      setTrades([]);
      setLatestImport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
    loadDashboardData();
  }, [init]);

  useAppEventListener(
    ["tradefourge:trade-created", "tradefourge:trade-updated", "tradefourge:trade-deleted", "tradefourge:import-created", "tradefourge:import-deleted"],
    () => {
      setTrades([]);
      loadDashboardData();
    }
  );

  // Analytics Engine Calculation
  const analytics: CompleteAnalyticsSummary = useMemo(() => {
    return calculateCloudAnalytics(trades);
  }, [trades]);

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  // Today's PnL
  const todaysPnL = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return trades
      .filter((t) => (t.close_time || t.open_time || "").startsWith(todayStr))
      .reduce((sum, t) => sum + (t.net_profit ?? (t.profit + t.commission + t.swap)), 0);
  }, [trades]);

  // Streak Calculation (Wins or Losses)
  const streakInfo = useMemo(() => {
    if (trades.length === 0) return { text: "No Trades", color: "text-gray-400", desc: "No trade activity recorded yet" };
    let winStreak = 0;
    let lossStreak = 0;

    for (const t of trades) {
      const pnl = t.net_profit ?? (t.profit + t.commission + t.swap);
      if (pnl > 0) {
        if (lossStreak > 0) break;
        winStreak++;
      } else if (pnl < 0) {
        if (winStreak > 0) break;
        lossStreak++;
      } else {
        break;
      }
    }

    if (winStreak > 0) return { text: `🔥 ${winStreak} W Streak`, color: "text-emerald-400", desc: `${winStreak} consecutive profitable trades` };
    if (lossStreak > 0) return { text: `❄️ ${lossStreak} L Streak`, color: "text-rose-400", desc: `${lossStreak} consecutive losing trades` };
    return { text: "Neutral", color: "text-gray-400", desc: "No active streak" };
  }, [trades]);

  // Max Drawdown Calculation
  const drawdownInfo = useMemo(() => {
    if (analytics.equityCurve.length === 0) return { pct: 0, amount: 0 };
    let peak = 0;
    let maxDd = 0;
    for (const pt of analytics.equityCurve) {
      if (pt.cumulativeProfit > peak) peak = pt.cumulativeProfit;
      const dd = peak - pt.cumulativeProfit;
      if (dd > maxDd) maxDd = dd;
    }
    const startingBal = defaultAccount?.starting_balance || 10000;
    const pct = peak > 0 ? ((maxDd / (startingBal + peak)) * 100).toFixed(1) : "0.0";
    return { pct, amount: maxDd };
  }, [analytics.equityCurve, defaultAccount]);

  // Filtered Equity Curve Data based on Time Range
  const filteredEquityCurve = useMemo(() => {
    if (timeRange === "ALL" || analytics.equityCurve.length === 0) {
      return analytics.equityCurve;
    }
    const daysMap: Record<TimeRange, number> = { "7D": 7, "30D": 30, "90D": 90, "ALL": 3650 };
    const cutoffDate = subDays(new Date(), daysMap[timeRange]).getTime();
    return analytics.equityCurve.filter((pt) => pt.timestamp >= cutoffDate);
  }, [analytics.equityCurve, timeRange]);

  // Recent 5 Trades
  const recentTrades = useMemo(() => trades.slice(0, 5), [trades]);

  // Find trade for largest win / loss for direct drawer opening
  const largestWinTrade = useMemo(() => {
    if (trades.length === 0 || analytics.largestWin <= 0) return null;
    return trades.find((t) => (t.net_profit ?? (t.profit + t.commission + t.swap)) === analytics.largestWin) || null;
  }, [trades, analytics.largestWin]);

  const largestLossTrade = useMemo(() => {
    if (trades.length === 0 || analytics.largestLoss >= 0) return null;
    return trades.find((t) => (t.net_profit ?? (t.profit + t.commission + t.swap)) === analytics.largestLoss) || null;
  }, [trades, analytics.largestLoss]);

  // Best & Most Traded Metrics
  const bestSessionName = useMemo(() => {
    if (analytics.sessions.length === 0) return "N/A";
    const sortedSess = [...analytics.sessions].sort((a, b) => b.netProfit - a.netProfit);
    return sortedSess[0]?.session || "N/A";
  }, [analytics.sessions]);

  const mostTradedSymbol = useMemo(() => {
    if (analytics.symbols.length === 0) return "N/A";
    const sortedSym = [...analytics.symbols].sort((a, b) => b.trades - a.trades);
    return sortedSym[0]?.symbol || "N/A";
  }, [analytics.symbols]);

  // Format Duration helper
  const formatHoldDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "N/A";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const isLight = theme === "light";
  const gridStroke = isLight ? "#E2E8F0" : "#1F293D";
  const axisStroke = isLight ? "#64748B" : "#6B7280";
  const purpleColor = "#7C3AED";

  const tooltipStyle: React.CSSProperties = isLight
    ? {
        backgroundColor: "#FFFFFF",
        borderColor: "#CBD5E1",
        borderRadius: "12px",
        color: "#0F172A",
        fontSize: "12px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
      }
    : {
        backgroundColor: "#0B0F19",
        borderColor: "#1E293B",
        borderRadius: "12px",
        color: "#FFFFFF",
        fontSize: "12px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
      };

  if (loading) {
    return (
      <div className="space-y-6 font-mono text-xs max-w-7xl mx-auto">
        <div className="h-28 rounded-2xl glass-card border border-dark-border animate-pulse" />
        <StatGridSkeleton count={8} />
        <div className="h-80 rounded-2xl glass-card border border-dark-border animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs font-mono max-w-7xl mx-auto pb-12">
      {/* ── SECTION 1: Welcome Header Strip ──────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-[#111726] border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-2xl">
        {/* Left: Greeting + User Identity + Active Account */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
              {greeting}, {profile?.full_name || "Trader"}
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600/20 text-purple-300 border border-purple-500/30 uppercase">
              Pro Terminal
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            {/* Quick Account Switcher */}
            <div className="relative">
              <button
                onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/40 text-white font-bold transition-all active:scale-95"
              >
                <Wallet className="w-3.5 h-3.5 text-purple-400" />
                <span>{defaultAccount?.account_name || "Primary Account"}</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300">
                  {defaultAccount?.currency || "USD"}
                </span>
              </button>

              {accountDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 p-2 rounded-2xl dropdown-menu z-50 space-y-1 shadow-2xl">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-dark-border">
                    Select Account ({accounts.length})
                  </div>
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        switchDefaultAccount(acc.id);
                        setAccountDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors ${
                        defaultAccount?.id === acc.id
                          ? "bg-purple-600/20 text-white font-bold"
                          : "text-gray-300 hover:bg-white/5"
                      }`}
                    >
                      <span className="truncate">{acc.account_name}</span>
                      <span className="text-[10px] text-emerald-400 font-bold">{acc.currency} {acc.current_balance.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span>•</span>
            <span className="text-gray-300">
              Balance: <strong className="text-white font-bold">{defaultAccount?.currency || "USD"} {defaultAccount?.current_balance.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "0.00"}</strong>
            </span>
            <span>•</span>
            <span className="text-gray-300">
              Today: <strong className={`font-bold ${todaysPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatSigned(todaysPnL)}</strong>
            </span>
          </div>
        </div>

        {/* Right: Productivity Quick Actions (Top-Right Shortcuts) */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Link
            href="/upload"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-glow active:scale-95"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </Link>

          <Link
            href="/journal"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-bold transition-all active:scale-95"
          >
            <TableProperties className="w-4 h-4 text-purple-400" />
            <span>Open Journal</span>
          </Link>

          <Link
            href="/performance"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-bold transition-all active:scale-95"
          >
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span>Performance Lab</span>
          </Link>

          <Link
            href="/accounts"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-bold transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Account</span>
          </Link>
        </div>
      </div>

      {/* ── Empty State Banner ───────────────────────────────────────────── */}
      {trades.length === 0 && (
        <EmptyState
          icon={Activity}
          title="No trading data available."
          description="Your cloud journal has no trade records. Import a CSV file or add trades manually to populate dashboard analytics, win rates, and situational metrics."
          action={{
            label: "Import CSV",
            href: "/upload",
          }}
          secondaryAction={{
            label: "Add Account",
            href: "/accounts",
          }}
        />
      )}

      {/* ── SECTION 2: 8 KPI Cards Grid (Interactive & Clickable) ──────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1. Balance */}
        <div
          onClick={() => router.push("/accounts")}
          className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
        >
          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300 transition-colors">BALANCE</span>
          <span className="text-sm font-extrabold text-white block truncate">
            {defaultAccount?.currency || "USD"} {defaultAccount?.current_balance.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "0.00"}
          </span>
          <span className="text-[9px] text-gray-400 block flex items-center justify-between">
            <span>Account Equity</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity" />
          </span>

          {/* Hover Tooltip */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
            <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Current Account Equity</p>
            <p className="text-gray-300">Total balance of your active trading account including realized PnL.</p>
            <p className="text-[10px] text-emerald-400 font-bold pt-1">Click to manage trading accounts →</p>
          </div>
        </div>

        {/* 2. Today's PnL */}
        <div
          onClick={() => router.push("/journal")}
          className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
        >
          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300 transition-colors">TODAY P&L</span>
          <span className={`text-sm font-extrabold block truncate ${todaysPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatSigned(todaysPnL)}
          </span>
          <span className="text-[9px] text-gray-400 block flex items-center justify-between">
            <span>Closed Today</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity" />
          </span>

          {/* Hover Tooltip */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
            <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Today's Session PnL</p>
            <p className="text-gray-300">Net profit/loss generated from trades closed during today's session.</p>
            <p className="text-[10px] text-emerald-400 font-bold pt-1">Click to view trade journal →</p>
          </div>
        </div>

        {/* 3. Total Net Profit */}
        <div
          onClick={() => router.push("/performance")}
          className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
        >
          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300 transition-colors">NET PROFIT</span>
          <span className={`text-sm font-extrabold block truncate ${analytics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatSigned(analytics.netProfit)}
          </span>
          <span className="text-[9px] text-gray-400 block flex items-center justify-between">
            <span>All-time PnL</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity" />
          </span>

          {/* Hover Tooltip */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
            <p className="font-bold text-purple-300 border-b border-white/10 pb-1">All-Time Cumulative Net PnL</p>
            <p className="text-gray-300">Gross profit minus gross loss, commissions, and swap across all cloud trades.</p>
            <p className="text-[10px] text-emerald-400 font-bold pt-1">Click for Performance Lab →</p>
          </div>
        </div>

        {/* 4. Win Rate */}
        <div
          onClick={() => router.push("/performance")}
          className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
        >
          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300 transition-colors">WIN RATE</span>
          <span className="text-sm font-extrabold text-purple-400 block truncate">
            {analytics.totalTrades > 0 ? `${analytics.winRate}%` : "—"}
          </span>
          <span className="text-[9px] text-gray-400 block flex items-center justify-between">
            <span>{analytics.wins}W / {analytics.losses}L</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity" />
          </span>

          {/* Hover Tooltip */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
            <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Winning Trade Accuracy</p>
            <p className="text-gray-300">{analytics.wins} winning trades out of {analytics.totalTrades} total closed positions.</p>
            <p className="text-[10px] text-emerald-400 font-bold pt-1">Click for Performance Lab →</p>
          </div>
        </div>

        {/* 5. Profit Factor */}
        <div
          onClick={() => router.push("/performance")}
          className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
        >
          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300 transition-colors">PROFIT FACTOR</span>
          <span className="text-sm font-extrabold text-white block truncate">
            {analytics.totalTrades > 0 ? analytics.profitFactor : "—"}
          </span>
          <span className="text-[9px] text-gray-400 block flex items-center justify-between">
            <span>Exp: {analytics.totalTrades > 0 ? `$${analytics.expectancy}` : "—"}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity" />
          </span>

          {/* Hover Tooltip */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
            <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Gross Profit / Gross Loss</p>
            <p className="text-gray-300">Values above 1.5 indicate a strong mathematical trading edge.</p>
            <p className="text-[10px] text-emerald-400 font-bold pt-1">Click for Performance Lab →</p>
          </div>
        </div>

        {/* 6. Average RR */}
        <div
          onClick={() => router.push("/performance")}
          className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
        >
          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300 transition-colors">AVG RR</span>
          <span className="text-sm font-extrabold text-indigo-400 block truncate">
            1:{analytics.avgRR}
          </span>
          <span className="text-[9px] text-gray-400 block flex items-center justify-between">
            <span>Reward : Risk</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity" />
          </span>

          {/* Hover Tooltip */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
            <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Average Risk-to-Reward</p>
            <p className="text-gray-300">Average realized gain per unit of risk taken across logged setups.</p>
            <p className="text-[10px] text-emerald-400 font-bold pt-1">Click for Performance Lab →</p>
          </div>
        </div>

        {/* 7. Drawdown */}
        <div
          onClick={() => router.push("/performance")}
          className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
        >
          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300 transition-colors">DRAWDOWN</span>
          <span className="text-sm font-extrabold text-rose-400 block truncate">
            -{drawdownInfo.pct}%
          </span>
          <span className="text-[9px] text-gray-400 block flex items-center justify-between">
            <span>Peak-to-Trough</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity" />
          </span>

          {/* Hover Tooltip */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
            <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Max Equity Drawdown</p>
            <p className="text-gray-300">Largest peak-to-trough equity contraction experienced: -${drawdownInfo.amount.toLocaleString()}.</p>
            <p className="text-[10px] text-emerald-400 font-bold pt-1">Click for Performance Lab →</p>
          </div>
        </div>

        {/* 8. Streak */}
        <div
          onClick={() => router.push("/journal")}
          className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
        >
          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300 transition-colors">STREAK</span>
          <span className={`text-xs font-extrabold block truncate ${streakInfo.color}`}>
            {streakInfo.text}
          </span>
          <span className="text-[9px] text-gray-400 block flex items-center justify-between">
            <span>Current Run</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity" />
          </span>

          {/* Hover Tooltip */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
            <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Active Trading Streak</p>
            <p className="text-gray-300">{streakInfo.desc}.</p>
            <p className="text-[10px] text-emerald-400 font-bold pt-1">Click to view trade journal →</p>
          </div>
        </div>
      </div>

      {/* ── ZERO STATE ONBOARDING (If no trades logged) ───────────────────── */}
      {trades.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#111726] border border-purple-500/30 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/30">
            <Upload className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-extrabold text-white">No trades imported yet</h3>
            <p className="text-xs text-gray-400">
              Upload your first MT4, MT5, cTrader, or brokerage CSV statement to unlock institutional trade analytics and performance metrics.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/upload"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-glow transition-all active:scale-95"
            >
              Upload CSV Statement
            </Link>
            <Link
              href="/accounts"
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-xs transition-all active:scale-95"
            >
              Create Account
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* ── SECTION 3: Large Responsive Equity Curve Chart ────────────── */}
          <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-purple-400" />
                  Equity Growth Curve
                </h2>
                <p className="text-xs text-gray-400">
                  Cumulative net profit trajectory over time · {currency}
                </p>
              </div>

              {/* Range Filters */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs shrink-0">
                {(["7D", "30D", "90D", "ALL"] as TimeRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                      timeRange === r
                        ? "bg-purple-600 text-white shadow-glow"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Equity Area Chart */}
            <div className="h-72 md:h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredEquityCurve}>
                  <defs>
                    <linearGradient id="dashboardEquityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={purpleColor} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={purpleColor} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                  <XAxis dataKey="date" stroke={axisStroke} fontSize={10} tickLine={false} />
                  <YAxis stroke={axisStroke} fontSize={10} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: unknown) => [formatSigned(Number(v)), "Cumulative Net PnL"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativeProfit"
                    stroke={purpleColor}
                    strokeWidth={2.5}
                    fill="url(#dashboardEquityGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── SECTION 4: Performance Snapshot Grid (Clickable Cards & Rich Tooltips) ── */}
          <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" />
                Performance Snapshot & Highlights
              </h2>
              <Link href="/performance" className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1">
                Full Performance Lab <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Best Symbol */}
              <div
                onClick={() => {
                  if (analytics.bestSymbol?.symbol) {
                    router.push(`/journal?search=${analytics.bestSymbol.symbol}`);
                  } else {
                    router.push("/performance");
                  }
                }}
                className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
              >
                <span className="text-[10px] text-gray-400 block uppercase font-bold group-hover:text-purple-300 transition-colors">BEST SYMBOL</span>
                <span className="text-sm font-extrabold text-emerald-400 block truncate">
                  {analytics.bestSymbol?.symbol || "N/A"}
                </span>
                <span className="text-[10px] text-gray-300 block font-bold flex items-center justify-between">
                  <span>{analytics.bestSymbol ? formatSigned(analytics.bestSymbol.netProfit) : "$0.00"}</span>
                  <ExternalLink className="w-3 h-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>

                {/* Hover Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-60 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
                  <p className="font-bold text-emerald-400 border-b border-white/10 pb-1">Top Performing Instrument</p>
                  <p className="text-gray-300">Highest gross net PnL symbol across logged history ({analytics.bestSymbol?.trades || 0} trades).</p>
                  <p className="text-[10px] text-purple-300 font-bold pt-1">Click to filter journal by {analytics.bestSymbol?.symbol || "symbol"} →</p>
                </div>
              </div>

              {/* Worst Symbol */}
              <div
                onClick={() => {
                  if (analytics.worstSymbol?.symbol) {
                    router.push(`/journal?search=${analytics.worstSymbol.symbol}`);
                  } else {
                    router.push("/performance");
                  }
                }}
                className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
              >
                <span className="text-[10px] text-gray-400 block uppercase font-bold group-hover:text-purple-300 transition-colors">WORST SYMBOL</span>
                <span className="text-sm font-extrabold text-rose-400 block truncate">
                  {analytics.worstSymbol?.symbol || "N/A"}
                </span>
                <span className="text-[10px] text-gray-300 block font-bold flex items-center justify-between">
                  <span>{analytics.worstSymbol ? formatSigned(analytics.worstSymbol.netProfit) : "$0.00"}</span>
                  <ExternalLink className="w-3 h-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>

                {/* Hover Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-60 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
                  <p className="font-bold text-rose-400 border-b border-white/10 pb-1">Lowest Performing Instrument</p>
                  <p className="text-gray-300">Instrument responsible for highest total net drag on equity.</p>
                  <p className="text-[10px] text-purple-300 font-bold pt-1">Click to filter journal by {analytics.worstSymbol?.symbol || "symbol"} →</p>
                </div>
              </div>

              {/* Best Day */}
              <div
                onClick={() => router.push("/calendar")}
                className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
              >
                <span className="text-[10px] text-gray-400 block uppercase font-bold group-hover:text-purple-300 transition-colors">BEST DAY OF WEEK</span>
                <span className="text-sm font-extrabold text-white block truncate">
                  {analytics.bestDay?.period || "N/A"}
                </span>
                <span className="text-[10px] text-emerald-400 block font-bold flex items-center justify-between">
                  <span>{analytics.bestDay ? formatSigned(analytics.bestDay.netProfit) : "$0.00"}</span>
                  <ExternalLink className="w-3 h-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>

                {/* Hover Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-60 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
                  <p className="font-bold text-emerald-400 border-b border-white/10 pb-1">Most Profitable Trading Day</p>
                  <p className="text-gray-300">Day of the week with highest cumulative net gains ({analytics.bestDay?.winRate || 0}% WR).</p>
                  <p className="text-[10px] text-purple-300 font-bold pt-1">Click to open trading calendar →</p>
                </div>
              </div>

              {/* Worst Day */}
              <div
                onClick={() => router.push("/calendar")}
                className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
              >
                <span className="text-[10px] text-gray-400 block uppercase font-bold group-hover:text-purple-300 transition-colors">WORST DAY OF WEEK</span>
                <span className="text-sm font-extrabold text-rose-400 block truncate">
                  {analytics.worstDay?.period || "N/A"}
                </span>
                <span className="text-[10px] text-gray-400 block flex items-center justify-between">
                  <span>{analytics.worstDay ? formatSigned(analytics.worstDay.netProfit) : "$0.00"}</span>
                  <ExternalLink className="w-3 h-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>

                {/* Hover Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-60 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
                  <p className="font-bold text-rose-400 border-b border-white/10 pb-1">Least Profitable Day</p>
                  <p className="text-gray-300">Day of the week exhibiting highest net losses.</p>
                  <p className="text-[10px] text-purple-300 font-bold pt-1">Click to open trading calendar →</p>
                </div>
              </div>

              {/* Best Session */}
              <div
                onClick={() => router.push("/performance")}
                className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
              >
                <span className="text-[10px] text-gray-400 block uppercase font-bold group-hover:text-purple-300 transition-colors">BEST SESSION</span>
                <span className="text-sm font-extrabold text-purple-300 block truncate">
                  {bestSessionName}
                </span>
                <span className="text-[10px] text-gray-400 block flex items-center justify-between">
                  <span>Top Session Edge</span>
                  <ExternalLink className="w-3 h-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>

                {/* Hover Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-60 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
                  <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Optimal Market Session</p>
                  <p className="text-gray-300">Market window (London, New York, Tokyo) delivering highest consistency.</p>
                  <p className="text-[10px] text-purple-300 font-bold pt-1">Click for Performance Lab analysis →</p>
                </div>
              </div>

              {/* Most Traded Instrument */}
              <div
                onClick={() => {
                  if (mostTradedSymbol && mostTradedSymbol !== "N/A") {
                    router.push(`/journal?search=${mostTradedSymbol}`);
                  } else {
                    router.push("/journal");
                  }
                }}
                className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
              >
                <span className="text-[10px] text-gray-400 block uppercase font-bold group-hover:text-purple-300 transition-colors">MOST TRADED</span>
                <span className="text-sm font-extrabold text-white block truncate">
                  {mostTradedSymbol}
                </span>
                <span className="text-[10px] text-gray-400 block flex items-center justify-between">
                  <span>Highest Volume</span>
                  <ExternalLink className="w-3 h-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>

                {/* Hover Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-60 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
                  <p className="font-bold text-white border-b border-white/10 pb-1">Highest Trade Frequency</p>
                  <p className="text-gray-300">Instrument representing highest number of executed trades.</p>
                  <p className="text-[10px] text-purple-300 font-bold pt-1">Click to filter journal by {mostTradedSymbol} →</p>
                </div>
              </div>

              {/* Largest Win */}
              <div
                onClick={() => {
                  if (largestWinTrade) {
                    setSelectedTrade(largestWinTrade);
                  } else {
                    router.push("/journal");
                  }
                }}
                className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
              >
                <span className="text-[10px] text-gray-400 block uppercase font-bold group-hover:text-purple-300 transition-colors">LARGEST WIN</span>
                <span className="text-sm font-extrabold text-emerald-400 block truncate">
                  {formatSigned(analytics.largestWin)}
                </span>
                <span className="text-[9px] text-gray-400 block flex items-center justify-between">
                  <span>Single Trade Peak</span>
                  <ExternalLink className="w-3 h-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>

                {/* Hover Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-60 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
                  <p className="font-bold text-emerald-400 border-b border-white/10 pb-1">Max Winning Trade</p>
                  <p className="text-gray-300">Highest single profit gain recorded ({largestWinTrade?.symbol || "Trade"}).</p>
                  <p className="text-[10px] text-purple-300 font-bold pt-1">Click to view trade drawer →</p>
                </div>
              </div>

              {/* Avg Hold Duration */}
              <div
                onClick={() => router.push("/performance")}
                className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative"
              >
                <span className="text-[10px] text-gray-400 block uppercase font-bold group-hover:text-purple-300 transition-colors">AVG DURATION</span>
                <span className="text-sm font-extrabold text-indigo-400 block truncate">
                  {formatHoldDuration(analytics.avgHoldSeconds)}
                </span>
                <span className="text-[9px] text-gray-400 block flex items-center justify-between">
                  <span>Average Hold Time</span>
                  <ExternalLink className="w-3 h-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>

                {/* Hover Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 bottom-full mb-2 left-1/2 -translate-x-1/2 w-60 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
                  <p className="font-bold text-indigo-400 border-b border-white/10 pb-1">Average Trade Hold Duration</p>
                  <p className="text-gray-300">Mean time elapsed between trade open time and trade execution exit.</p>
                  <p className="text-[10px] text-purple-300 font-bold pt-1">Click for Performance Lab →</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 5: Recent Activity (Latest Trades & Imports) ────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Latest 5 Trades (2 cols) */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  Recent Trades
                </h2>
                <Link href="/journal" className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1">
                  View Full Journal <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-2">
                {recentTrades.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTrade(t)}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-purple-500/40 cursor-pointer flex items-center justify-between transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        t.side === "BUY" || t.side === "LONG" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {t.side === "BUY" || t.side === "LONG" ? "L" : "S"}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{t.symbol}</span>
                          <span className="text-[10px] text-gray-400">{t.volume} Lots</span>
                        </div>
                        <span className="text-[10px] text-gray-400 block">
                          {t.close_time ? format(parseISO(t.close_time), "MMM dd, HH:mm") : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`font-extrabold text-xs block ${t.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatSigned(t.net_profit)}
                      </span>
                      <span className="text-[9px] text-gray-400 block">Net PnL</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent CSV Imports & Notes (1 col) */}
            <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  Recent CSV Import
                </h2>
                <Link href="/import-history" className="text-xs text-purple-400 hover:text-purple-300 font-bold">
                  History →
                </Link>
              </div>

              {latestImport ? (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate max-w-[140px]">{latestImport.filename}</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {latestImport.import_status}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Imported Trades:</span>
                      <span className="text-white font-bold">{latestImport.imported_rows}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform:</span>
                      <span className="text-purple-300 font-bold">{latestImport.platform || "Standard"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uploaded:</span>
                      <span className="text-gray-300">{latestImport.uploaded_at ? format(parseISO(latestImport.uploaded_at), "MMM dd, HH:mm") : "—"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-xs py-4 text-center">No CSV imports uploaded yet.</p>
              )}

              {/* Quick Productivity Hint */}
              <div className="p-3 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-300 text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Situational Awareness Tip</span>
                </div>
                <p className="text-[10px] text-gray-300 leading-relaxed">
                  Review your Equity Curve and KPI drawdown before starting a new session. Deep statistical breakdowns are available in Performance Lab.
                </p>
              </div>
            </div>
          </div>
        </>
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
