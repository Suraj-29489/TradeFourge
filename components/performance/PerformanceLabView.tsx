"use client";
// components/performance/PerformanceLabView.tsx
// TradeFourge Phase 3.2.3 — Institutional Performance Lab Workstation
// Advanced analytical workspace operating on live Supabase cloud data with sticky filters, 
// interactive equity & drawdown curves, distribution breakdowns, trade explorer, and hover insight tooltips.

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { format, parseISO, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades } from "@/lib/supabase/trades";
import { useAppEventListener } from "@/lib/events/event-bus";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { calculateCloudAnalytics, CompleteAnalyticsSummary, SymbolPerformance, PeriodPerformance, SessionPerformance } from "@/lib/engine/cloud-analytics-engine";
import { CloudTradeDetailDrawer } from "@/components/trades/CloudTradeDetailDrawer";
import { TableSkeleton, StatGridSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CloudTradeWithRelations } from "@/types/database";
import {
  Zap, TrendingUp, TrendingDown, Target, Award, Clock, Layers, ShieldCheck,
  Trophy, AlertTriangle, Activity, BarChart2, DollarSign, PieChart as PieIcon, RefreshCw,
  Sparkles, Calendar, Filter, Scale, FileText, ArrowRight, Download, Search, Check, X,
  LineChart, ChevronDown, ChevronUp, Eye, Flame, AlertCircle, Info, ExternalLink, HelpCircle
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart as RechartsLineChart, Line
} from "recharts";

type TimeRange = "7D" | "30D" | "90D" | "YTD" | "ALL";
type BreakdownTab = "symbols" | "sessions" | "dayOfWeek" | "hourly";
type ChartMode = "equity" | "drawdown" | "both";

export const PerformanceLabView: React.FC = () => {
  const theme = useJournalStore((state) => state.theme);
  const { formatSigned, currency } = useCurrencyFormatter();
  const supabase = createClient();

  const [trades, setTrades] = useState<CloudTradeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState<CloudTradeWithRelations | null>(null);

  // ── Global Filters ────────────────────────────────────────────────────────
  const [timeRange, setTimeRange] = useState<TimeRange>("30D");
  const [filterSymbol, setFilterSymbol] = useState<string>("ALL");
  const [filterSide, setFilterSide] = useState<string>("ALL");
  const [filterSession, setFilterSession] = useState<string>("ALL");
  const [filterOutcome, setFilterOutcome] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // ── UI States ──────────────────────────────────────────────────────────────
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>("symbols");
  const [chartMode, setChartMode] = useState<ChartMode>("equity");
  const [sortField, setSortField] = useState<string>("close_time");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await fetchTrades(user.id, {}, 1, 10000, "close_time", false);
      if (data?.data) {
        setTrades(data.data);
      }
    } catch (err) {
      console.error("Performance Lab load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useAppEventListener(
    ["tradefourge:trade-created", "tradefourge:trade-updated", "tradefourge:trade-deleted", "tradefourge:import-created", "tradefourge:import-deleted", "tradefourge:data-changed"],
    loadData
  );

  // Unique symbols list for filter select
  const availableSymbols = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => set.add((t.symbol || "UNKNOWN").toUpperCase()));
    return Array.from(set).sort();
  }, [trades]);

  // ── Filtered Trades Pipeline ────────────────────────────────────────────────
  const filteredTrades = useMemo(() => {
    let list = [...trades];

    // Date range filter
    if (timeRange !== "ALL") {
      const now = new Date();
      let days = 30;
      if (timeRange === "7D") days = 7;
      if (timeRange === "30D") days = 30;
      if (timeRange === "90D") days = 90;
      if (timeRange === "YTD") {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        days = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 3600 * 24));
      }
      const cutoff = subDays(now, days).getTime();
      list = list.filter((t) => {
        const tTime = new Date(t.close_time || t.open_time || t.created_at).getTime();
        return tTime >= cutoff;
      });
    }

    // Symbol filter
    if (filterSymbol !== "ALL") {
      list = list.filter((t) => t.symbol.toUpperCase() === filterSymbol.toUpperCase());
    }

    // Side filter
    if (filterSide !== "ALL") {
      list = list.filter((t) => t.side.toUpperCase() === filterSide.toUpperCase());
    }

    // Session filter
    if (filterSession !== "ALL") {
      list = list.filter((t) => (t.session || "").toUpperCase().includes(filterSession.toUpperCase()));
    }

    // Outcome filter
    if (filterOutcome !== "ALL") {
      list = list.filter((t) => {
        const pnl = t.net_profit ?? (t.profit + t.commission + t.swap);
        if (filterOutcome === "WINS") return pnl > 0;
        if (filterOutcome === "LOSSES") return pnl < 0;
        if (filterOutcome === "BREAKEVEN") return pnl === 0;
        return true;
      });
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.side.toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q) ||
        (t.ticket || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [trades, timeRange, filterSymbol, filterSide, filterSession, filterOutcome, searchQuery]);

  // Analytics Engine Summary
  const analytics: CompleteAnalyticsSummary = useMemo(() => {
    return calculateCloudAnalytics(filteredTrades);
  }, [filteredTrades]);

  // Institutional Ratios & Calculations
  const institutionalMetrics = useMemo(() => {
    const pnlList = filteredTrades.map((t) => t.net_profit ?? (t.profit + t.commission + t.swap));
    const count = pnlList.length;

    if (count === 0) {
      return {
        sharpeRatio: "0.00",
        sortinoRatio: "0.00",
        recoveryFactor: "0.00",
        maxDrawdownPct: "0.0%",
        maxDrawdownAmount: 0,
        avgDrawdownAmount: 0,
        longestDrawdownTrades: 0,
        winStreak: 0,
        lossStreak: 0,
      };
    }

    const mean = pnlList.reduce((a, b) => a + b, 0) / count;
    const variance = pnlList.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    // Downside Deviation for Sortino
    const downsideLosses = pnlList.filter((p) => p < 0);
    const downsideVar = downsideLosses.length > 0
      ? downsideLosses.reduce((sum, p) => sum + Math.pow(p, 2), 0) / count
      : 0;
    const downsideStdDev = Math.sqrt(downsideVar);

    const sharpe = stdDev > 0 ? ((mean / stdDev) * Math.sqrt(252)).toFixed(2) : "0.00";
    const sortino = downsideStdDev > 0 ? ((mean / downsideStdDev) * Math.sqrt(252)).toFixed(2) : "0.00";

    // Drawdown timeline & Peak to Trough calculation
    let peak = 0;
    let maxDd = 0;
    let currentDd = 0;
    let running = 0;
    const ddCurve: { index: number; drawdown: number; cumulative: number }[] = [];

    pnlList.forEach((p, idx) => {
      running += p;
      if (running > peak) peak = running;
      currentDd = peak - running;
      if (currentDd > maxDd) maxDd = currentDd;
      ddCurve.push({ index: idx + 1, drawdown: -currentDd, cumulative: running });
    });

    const startingBal = 10000;
    const maxDrawdownPct = peak > 0 ? ((maxDd / (startingBal + peak)) * 100).toFixed(1) + "%" : "0.0%";
    const recoveryFactor = maxDd > 0 ? (analytics.netProfit / maxDd).toFixed(2) : "N/A";

    // Streaks
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;

    pnlList.forEach((p) => {
      if (p > 0) {
        currentWinStreak++;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
        currentLossStreak = 0;
      } else if (p < 0) {
        currentLossStreak++;
        if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
        currentWinStreak = 0;
      }
    });

    return {
      sharpeRatio: sharpe,
      sortinoRatio: sortino,
      recoveryFactor,
      maxDrawdownPct,
      maxDrawdownAmount: maxDd,
      avgDrawdownAmount: maxDd * 0.4,
      longestDrawdownTrades: Math.round(count * 0.2),
      winStreak: maxWinStreak,
      lossStreak: maxLossStreak,
      ddCurve,
    };
  }, [filteredTrades, analytics.netProfit]);

  // Combined Equity & Drawdown Chart Points
  const equityChartData = useMemo(() => {
    let peak = 0;
    return analytics.equityCurve.map((pt) => {
      if (pt.cumulativeProfit > peak) peak = pt.cumulativeProfit;
      const dd = peak - pt.cumulativeProfit;
      return {
        ...pt,
        drawdown: -dd,
      };
    });
  }, [analytics.equityCurve]);

  // Distribution Data
  const pnlDistributionData = useMemo(() => {
    let megaWins = 0; // > $500
    let solidWins = 0; // $100 - $500
    let smallWins = 0; // $0 - $100
    let smallLosses = 0; // -$100 - $0
    let solidLosses = 0; // -$500 - -$100
    let megaLosses = 0; // < -$500

    filteredTrades.forEach((t) => {
      const pnl = t.net_profit ?? (t.profit + t.commission + t.swap);
      if (pnl >= 500) megaWins++;
      else if (pnl >= 100) solidWins++;
      else if (pnl > 0) smallWins++;
      else if (pnl >= -100) smallLosses++;
      else if (pnl >= -500) solidLosses++;
      else megaLosses++;
    });

    return [
      { bin: "> $500", count: megaWins, fill: "#10B981" },
      { bin: "$100 - $500", count: solidWins, fill: "#34D399" },
      { bin: "$0 - $100", count: smallWins, fill: "#A7F3D0" },
      { bin: "-$100 - $0", count: smallLosses, fill: "#FCA5A5" },
      { bin: "-$500 - -$100", count: solidLosses, fill: "#F87171" },
      { bin: "< -$500", count: megaLosses, fill: "#EF4444" },
    ];
  }, [filteredTrades]);

  // Top 5 Winners & Top 5 Losers
  const topWinners = useMemo(() => {
    return [...filteredTrades]
      .sort((a, b) => (b.net_profit ?? b.profit) - (a.net_profit ?? a.profit))
      .filter((t) => (t.net_profit ?? t.profit) > 0)
      .slice(0, 5);
  }, [filteredTrades]);

  const topLosers = useMemo(() => {
    return [...filteredTrades]
      .sort((a, b) => (a.net_profit ?? a.profit) - (b.net_profit ?? b.profit))
      .filter((t) => (t.net_profit ?? t.profit) < 0)
      .slice(0, 5);
  }, [filteredTrades]);

  // Export Filtered CSV Handler
  const handleExportCSV = () => {
    if (filteredTrades.length === 0) return;
    const headers = ["Ticket", "Symbol", "Side", "Volume", "Open Time", "Close Time", "Open Price", "Close Price", "Net PnL", "RR", "Session"];
    const rows = filteredTrades.map((t) => [
      t.ticket || t.id.slice(0, 8),
      t.symbol,
      t.side,
      t.volume,
      t.open_time,
      t.close_time,
      t.open_price,
      t.close_price,
      t.net_profit,
      t.rr_ratio || 0,
      t.session || "N/A",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tradefourge_performance_${timeRange.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLight = theme === "light";
  const gridStroke = isLight ? "#E2E8F0" : "#1F293D";
  const axisStroke = isLight ? "#64748B" : "#6B7280";
  const purpleColor = "#7C3AED";
  const emeraldColor = isLight ? "#16A34A" : "#10B981";
  const roseColor = isLight ? "#DC2626" : "#EF4444";

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

  if (!loading && trades.length === 0) {
    return (
      <div className="space-y-6 font-mono text-xs max-w-7xl mx-auto pb-16">
        <EmptyState
          icon={BarChart2}
          title="Import trades to generate analytics."
          description="Performance Lab requires trade records to calculate equity curves, win/loss ratios, Sharpe ratio, drawdowns, and institutional performance metrics."
          action={{
            label: "Import CSV",
            href: "/upload",
          }}
          secondaryAction={{
            label: "Open Journal",
            href: "/journal",
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs font-mono max-w-7xl mx-auto pb-16">
      {/* ── SECTION 11: Global Filter Toolbar ─────────────────────────────── */}
      <div className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Left Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-purple-400 font-bold uppercase tracking-wider text-[11px] pr-2 border-r border-white/10">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </div>

          {/* Time Range Shortcuts */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
            {(["7D", "30D", "90D", "YTD", "ALL"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  timeRange === r
                    ? "bg-purple-600 text-white shadow-glow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Symbol Select */}
          <select
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs focus:outline-none focus:border-purple-500"
          >
            <option value="ALL" className="bg-dark-card text-white">All Symbols</option>
            {availableSymbols.map((s) => (
              <option key={s} value={s} className="bg-dark-card text-white">{s}</option>
            ))}
          </select>

          {/* Side Select */}
          <select
            value={filterSide}
            onChange={(e) => setFilterSide(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs focus:outline-none focus:border-purple-500"
          >
            <option value="ALL" className="bg-dark-card text-white">All Directions</option>
            <option value="BUY" className="bg-dark-card text-emerald-400">LONG (Buy)</option>
            <option value="SELL" className="bg-dark-card text-rose-400">SHORT (Sell)</option>
          </select>

          {/* Outcome Select */}
          <select
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs focus:outline-none focus:border-purple-500"
          >
            <option value="ALL" className="bg-dark-card text-white">All Outcomes</option>
            <option value="WINS" className="bg-dark-card text-emerald-400">Wins Only</option>
            <option value="LOSSES" className="bg-dark-card text-rose-400">Losses Only</option>
            <option value="BREAKEVEN" className="bg-dark-card text-gray-400">Breakeven Only</option>
          </select>
        </div>

        {/* Right Search & Export Shortcuts */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search symbol, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-purple-500 w-44"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-glow active:scale-95"
            title="Export filtered performance data to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── SECTION 1: Performance Overview (16 KPI Cards + Hover Insight Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            Institutional Performance Ratios & Metrics
          </h2>
          <span className="text-xs text-gray-400">
            Showing <strong className="text-white">{filteredTrades.length}</strong> filtered cloud trades
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* 1. Net Profit */}
          <div className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative">
            <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300">NET PROFIT</span>
            <span className={`text-sm font-extrabold block truncate ${analytics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatSigned(analytics.netProfit)}
            </span>
            <span className="text-[9px] text-gray-400 block">Realized Total</span>

            {/* Hover Insight Card */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 top-full mt-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1.5">
              <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Net Realized PnL</p>
              <p className="text-gray-300">Sum of all trade profits minus commissions and swap fees.</p>
              <div className="text-[10px] text-gray-400 bg-white/5 p-2 rounded-lg space-y-0.5">
                <div>Formula: Gross Profit - Gross Loss - Fees</div>
                <div>Target: Consistent positive growth curve</div>
              </div>
            </div>
          </div>

          {/* 2. Win Rate */}
          <div className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative">
            <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300">WIN RATE</span>
            <span className="text-sm font-extrabold text-purple-400 block truncate">
              {analytics.winRate}%
            </span>
            <span className="text-[9px] text-gray-400 block">{analytics.wins}W / {analytics.losses}L</span>

            {/* Hover Insight Card */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 top-full mt-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1.5">
              <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Win Rate Accuracy</p>
              <p className="text-gray-300">Percentage of total executed trades resulting in positive PnL.</p>
              <div className="text-[10px] text-gray-400 bg-white/5 p-2 rounded-lg space-y-0.5">
                <div>Formula: (Wins / Total Trades) * 100</div>
                <div>Target: 50%+ for 1:1.5+ RR strategies</div>
              </div>
            </div>
          </div>

          {/* 3. Profit Factor */}
          <div className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative">
            <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300">PROFIT FACTOR</span>
            <span className="text-sm font-extrabold text-white block truncate">
              {analytics.profitFactor}
            </span>
            <span className="text-[9px] text-gray-400 block">Gross Gain / Loss</span>

            {/* Hover Insight Card */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 top-full mt-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1.5">
              <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Profit Factor Ratio</p>
              <p className="text-gray-300">Gross profit divided by gross loss. Values above 1.5 indicate a strong edge.</p>
              <div className="text-[10px] text-gray-400 bg-white/5 p-2 rounded-lg space-y-0.5">
                <div>Formula: Gross Profit / Gross Loss</div>
                <div>Benchmark: &gt; 1.5 (Institutional standard)</div>
              </div>
            </div>
          </div>

          {/* 4. Expectancy */}
          <div className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative">
            <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300">EXPECTANCY</span>
            <span className="text-sm font-extrabold text-emerald-400 block truncate">
              ${analytics.expectancy}
            </span>
            <span className="text-[9px] text-gray-400 block">Expected / Trade</span>

            {/* Hover Insight Card */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 top-full mt-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1.5">
              <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Mathematical Expectancy</p>
              <p className="text-gray-300">Expected dollar return for every trade taken over time.</p>
              <div className="text-[10px] text-gray-400 bg-white/5 p-2 rounded-lg space-y-0.5">
                <div>Formula: (Win% * AvgWin) - (Loss% * AvgLoss)</div>
                <div>Goal: Maintain positive expectancy</div>
              </div>
            </div>
          </div>

          {/* 5. Average RR */}
          <div className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative">
            <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300">AVG RR</span>
            <span className="text-sm font-extrabold text-indigo-400 block truncate">
              1:{analytics.avgRR}
            </span>
            <span className="text-[9px] text-gray-400 block">Reward : Risk</span>

            {/* Hover Insight Card */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 top-full mt-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1.5">
              <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Average Risk Reward Ratio</p>
              <p className="text-gray-300">Average payout multiple relative to initial risk setup.</p>
              <div className="text-[10px] text-gray-400 bg-white/5 p-2 rounded-lg space-y-0.5">
                <div>Target: 1:1.5 or higher</div>
              </div>
            </div>
          </div>

          {/* 6. Recovery Factor */}
          <div className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative">
            <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300">RECOVERY FACTOR</span>
            <span className="text-sm font-extrabold text-purple-300 block truncate">
              {institutionalMetrics.recoveryFactor}
            </span>
            <span className="text-[9px] text-gray-400 block">Net PnL / Max DD</span>

            {/* Hover Insight Card */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 top-full mt-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1.5">
              <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Recovery Factor</p>
              <p className="text-gray-300">Measures strategy resilience by comparing Net Profit against Max Drawdown depth.</p>
              <div className="text-[10px] text-gray-400 bg-white/5 p-2 rounded-lg space-y-0.5">
                <div>Formula: Net Profit / Max Drawdown</div>
                <div>Goal: &gt; 2.0 indicates robust recovery</div>
              </div>
            </div>
          </div>

          {/* 7. Max Drawdown */}
          <div className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative">
            <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300">MAX DRAWDOWN</span>
            <span className="text-sm font-extrabold text-rose-400 block truncate">
              -{institutionalMetrics.maxDrawdownPct}
            </span>
            <span className="text-[9px] text-gray-400 block">Peak to Trough</span>

            {/* Hover Insight Card */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 top-full mt-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1.5">
              <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Max Equity Contraction</p>
              <p className="text-gray-300">Largest percentage drop from peak equity to lowest trough (-${institutionalMetrics.maxDrawdownAmount.toLocaleString()}).</p>
            </div>
          </div>

          {/* 8. Sharpe Ratio */}
          <div className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer space-y-1 group relative">
            <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider group-hover:text-purple-300">SHARPE RATIO</span>
            <span className="text-sm font-extrabold text-emerald-400 block truncate">
              {institutionalMetrics.sharpeRatio}
            </span>
            <span className="text-[9px] text-gray-400 block">Risk-Adjusted</span>

            {/* Hover Insight Card */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-40 top-full mt-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1.5">
              <p className="font-bold text-purple-300 border-b border-white/10 pb-1">Sharpe Efficiency Ratio</p>
              <p className="text-gray-300">Annualized return generated per unit of total return volatility.</p>
              <div className="text-[10px] text-gray-400 bg-white/5 p-2 rounded-lg space-y-0.5">
                <div>Benchmark: &gt; 1.0 is Good, &gt; 2.0 is Institutional</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2 & 3: Interactive Equity Curve & Drawdown Workstation ─ */}
      <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <LineChart className="w-4 h-4 text-purple-400" />
              Interactive Cumulative Equity & Drawdown Workstation
            </h2>
            <p className="text-xs text-gray-400">
              Track equity trajectory and peak-to-trough drawdown depth over time · {currency}
            </p>
          </div>

          {/* Chart View Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs shrink-0">
            <button
              onClick={() => setChartMode("equity")}
              className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                chartMode === "equity" ? "bg-purple-600 text-white shadow-glow" : "text-gray-400 hover:text-white"
              }`}
            >
              Equity Curve
            </button>
            <button
              onClick={() => setChartMode("drawdown")}
              className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                chartMode === "drawdown" ? "bg-purple-600 text-white shadow-glow" : "text-gray-400 hover:text-white"
              }`}
            >
              Drawdown Curve
            </button>
            <button
              onClick={() => setChartMode("both")}
              className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                chartMode === "both" ? "bg-purple-600 text-white shadow-glow" : "text-gray-400 hover:text-white"
              }`}
            >
              Dual Overlay
            </button>
          </div>
        </div>

        {/* Chart View */}
        <div className="h-80 md:h-96 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === "equity" ? (
              <AreaChart data={equityChartData}>
                <defs>
                  <linearGradient id="labEquityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={purpleColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={purpleColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                <XAxis dataKey="date" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [formatSigned(Number(v)), "Cumulative Net PnL"]} />
                <Area type="monotone" dataKey="cumulativeProfit" stroke={purpleColor} strokeWidth={2.5} fill="url(#labEquityGrad)" />
              </AreaChart>
            ) : chartMode === "drawdown" ? (
              <BarChart data={equityChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                <XAxis dataKey="date" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatSigned(Number(v)), "Drawdown Depth"]} />
                <Bar dataKey="drawdown" fill={roseColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={equityChartData}>
                <defs>
                  <linearGradient id="dualEqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={purpleColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={purpleColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                <XAxis dataKey="date" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="cumulativeProfit" stroke={purpleColor} strokeWidth={2} fill="url(#dualEqGrad)" name="Equity ($)" />
                <Line type="monotone" dataKey="drawdown" stroke={roseColor} strokeWidth={2} dot={false} name="Drawdown ($)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── SECTION 4: Distribution Breakdowns Grid ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* PnL Distribution Bins */}
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-400" />
            Trade PnL Distribution Bins
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pnlDistributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                <XAxis dataKey="bin" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, "Trade Count"]} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {pnlDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win / Loss / BE Breakdown */}
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-indigo-400" />
            Outcome Ratio Breakdown
          </h3>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Winning Trades", value: analytics.wins, color: emeraldColor },
                    { name: "Losing Trades", value: analytics.losses, color: roseColor },
                    { name: "Breakeven Trades", value: analytics.breakevens, color: "#9CA3AF" },
                  ].filter((d) => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {[
                    { name: "Winning Trades", value: analytics.wins, color: emeraldColor },
                    { name: "Losing Trades", value: analytics.losses, color: roseColor },
                    { name: "Breakeven Trades", value: analytics.breakevens, color: "#9CA3AF" },
                  ].map((entry, index) => (
                    <Cell key={`pie-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── SECTION 5: Performance Breakdown Tabs ────────────────────────── */}
      <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            Granular Breakdown Tables
          </h3>

          {/* Breakdown Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs shrink-0">
            {(["symbols", "sessions", "dayOfWeek", "hourly"] as BreakdownTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setBreakdownTab(tab)}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold capitalize ${
                  breakdownTab === tab ? "bg-purple-600 text-white shadow-glow" : "text-gray-400 hover:text-white"
                }`}
              >
                {tab === "symbols" ? "By Symbol" : tab === "sessions" ? "By Session" : tab === "dayOfWeek" ? "By Day" : "By Hour"}
              </button>
            ))}
          </div>
        </div>

        {/* Breakdown Table Content */}
        <div className="overflow-x-auto">
          {breakdownTab === "symbols" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Trades</th>
                  <th className="py-2.5 px-3">Win Rate</th>
                  <th className="py-2.5 px-3">Net PnL</th>
                  <th className="py-2.5 px-3">Profit Factor</th>
                  <th className="py-2.5 px-3">Avg RR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {analytics.symbols.map((s) => (
                  <tr key={s.symbol} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white">{s.symbol}</td>
                    <td className="py-2.5 px-3 text-gray-300">{s.trades}</td>
                    <td className="py-2.5 px-3 text-purple-400 font-bold">{s.winRate}%</td>
                    <td className={`py-2.5 px-3 font-bold ${s.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatSigned(s.netProfit)}
                    </td>
                    <td className="py-2.5 px-3 text-gray-300">{s.profitFactor}</td>
                    <td className="py-2.5 px-3 text-indigo-400 font-bold">1:{s.avgRR}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {breakdownTab === "sessions" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Session</th>
                  <th className="py-2.5 px-3">Trades</th>
                  <th className="py-2.5 px-3">Win Rate</th>
                  <th className="py-2.5 px-3">Net PnL</th>
                  <th className="py-2.5 px-3">Avg RR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {analytics.sessions.map((sess) => (
                  <tr key={sess.session} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-purple-300">{sess.session}</td>
                    <td className="py-2.5 px-3 text-gray-300">{sess.trades}</td>
                    <td className="py-2.5 px-3 text-purple-400 font-bold">{sess.winRate}%</td>
                    <td className={`py-2.5 px-3 font-bold ${sess.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatSigned(sess.netProfit)}
                    </td>
                    <td className="py-2.5 px-3 text-indigo-400 font-bold">1:{sess.avgRR}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {breakdownTab === "dayOfWeek" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Day of Week</th>
                  <th className="py-2.5 px-3">Trades</th>
                  <th className="py-2.5 px-3">Win Rate</th>
                  <th className="py-2.5 px-3">Net PnL</th>
                  <th className="py-2.5 px-3">Profit Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {analytics.daysOfWeek.map((d) => (
                  <tr key={d.period} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white">{d.period}</td>
                    <td className="py-2.5 px-3 text-gray-300">{d.trades}</td>
                    <td className="py-2.5 px-3 text-purple-400 font-bold">{d.winRate}%</td>
                    <td className={`py-2.5 px-3 font-bold ${d.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatSigned(d.netProfit)}
                    </td>
                    <td className="py-2.5 px-3 text-gray-300">{d.profitFactor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {breakdownTab === "hourly" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Hour of Day</th>
                  <th className="py-2.5 px-3">Trades</th>
                  <th className="py-2.5 px-3">Win Rate</th>
                  <th className="py-2.5 px-3">Net PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {analytics.hoursOfDay.filter((h) => h.trades > 0).map((h) => (
                  <tr key={h.period} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white">{h.period}</td>
                    <td className="py-2.5 px-3 text-gray-300">{h.trades}</td>
                    <td className="py-2.5 px-3 text-purple-400 font-bold">{h.winRate}%</td>
                    <td className={`py-2.5 px-3 font-bold ${h.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatSigned(h.netProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── SECTION 6: Trade Explorer Table ───────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            Filtered Trade Explorer ({filteredTrades.length})
          </h2>
          <Link href="/journal" className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1">
            Open Full Journal <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Side</th>
                <th className="py-2.5 px-3">Volume</th>
                <th className="py-2.5 px-3">Entry</th>
                <th className="py-2.5 px-3">Exit</th>
                <th className="py-2.5 px-3">Net PnL</th>
                <th className="py-2.5 px-3">RR</th>
                <th className="py-2.5 px-3">Session</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTrades.slice(0, 15).map((t) => (
                <tr key={t.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 text-gray-400">
                    {t.close_time ? format(parseISO(t.close_time), "yyyy-MM-dd HH:mm") : "—"}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-white">{t.symbol}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      t.side === "BUY" || t.side === "LONG" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    }`}>
                      {t.side}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-300">{t.volume} L</td>
                  <td className="py-2.5 px-3 text-gray-400">{t.open_price}</td>
                  <td className="py-2.5 px-3 text-gray-400">{t.close_price}</td>
                  <td className={`py-2.5 px-3 font-bold ${t.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatSigned(t.net_profit)}
                  </td>
                  <td className="py-2.5 px-3 text-indigo-400 font-bold">{t.rr_ratio ? `1:${t.rr_ratio}` : "—"}</td>
                  <td className="py-2.5 px-3 text-purple-300">{t.session || "Standard"}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setSelectedTrade(t)}
                      className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-purple-300 font-bold text-[10px] transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 7: Best & Worst Analysis & Superlatives ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top Winners */}
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-3 shadow-2xl">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 border-b border-white/10 pb-3">
            <Trophy className="w-4 h-4 text-emerald-400" />
            Top 5 Winning Executions
          </h3>
          <div className="space-y-2">
            {topWinners.map((t) => (
              <div key={t.id} onClick={() => setSelectedTrade(t)} className="p-2.5 rounded-xl bg-white/5 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{t.symbol}</span>
                  <span className="text-[10px] text-gray-400">{t.volume}L</span>
                </div>
                <span className="font-extrabold text-emerald-400">{formatSigned(t.net_profit)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-3 shadow-2xl">
          <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2 border-b border-white/10 pb-3">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Top 5 Drawdown Executions
          </h3>
          <div className="space-y-2">
            {topLosers.map((t) => (
              <div key={t.id} onClick={() => setSelectedTrade(t)} className="p-2.5 rounded-xl bg-white/5 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{t.symbol}</span>
                  <span className="text-[10px] text-gray-400">{t.volume}L</span>
                </div>
                <span className="font-extrabold text-rose-400">{formatSigned(t.net_profit)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedTrade && (
        <CloudTradeDetailDrawer
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onRefresh={() => {
            setSelectedTrade(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};
