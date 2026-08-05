"use client";
// components/statistics/StatisticsView.tsx
// Deep Diagnostic Performance Lab Workspace
// Answers "Why am I performing this way?" with symbol comparisons, session analytics, drawdown curves, and advanced filters.

import React, { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades } from "@/lib/supabase/trades";
import { calculateCloudAnalytics, CompleteAnalyticsSummary, SymbolPerformance, PeriodPerformance, SessionPerformance } from "@/lib/engine/cloud-analytics-engine";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { ExportToolbar } from "@/components/export/ExportToolbar";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import type { CloudTradeWithRelations } from "@/types/database";
import {
  Zap, TrendingUp, TrendingDown, Target, Award, Clock, Layers, ShieldCheck,
  Trophy, AlertTriangle, Activity, BarChart2, DollarSign, PieChart, RefreshCw,
  Sparkles, Calendar, Filter, PlayCircle, Scale, FileText, ArrowRight
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
  const { formatSigned, symbol } = useCurrencyFormatter();
  const supabase = createClient();

  const [trades, setTrades] = useState<CloudTradeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "symbols" | "time" | "drawdown" | "compare" | "replay">("overview");

  // Filters
  const [filterSymbol, setFilterSymbol] = useState<string>("ALL");
  const [filterSide, setFilterSide] = useState<string>("ALL");
  const [filterOutcome, setFilterOutcome] = useState<string>("ALL");

  // Selection for comparison
  const [compareSymbolA, setCompareSymbolA] = useState<string>("");
  const [compareSymbolB, setCompareSymbolB] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await fetchTrades(user.id, {}, 1, 10000, "close_time", false);
        setTrades(data?.data ?? []);
      } else {
        setTrades([]);
      }
    } catch (err) {
      console.error("Failed to load statistics:", err);
      setTrades([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered trade list
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (filterSymbol !== "ALL" && t.symbol.toUpperCase() !== filterSymbol.toUpperCase()) return false;
      if (filterSide !== "ALL" && t.side.toUpperCase() !== filterSide.toUpperCase()) return false;
      if (filterOutcome === "WINS" && (t.net_profit ?? t.profit) <= 0) return false;
      if (filterOutcome === "LOSSES" && (t.net_profit ?? t.profit) >= 0) return false;
      return true;
    });
  }, [trades, filterSymbol, filterSide, filterOutcome]);

  const analytics: CompleteAnalyticsSummary = useMemo(() => {
    return calculateCloudAnalytics(filteredTrades);
  }, [filteredTrades]);

  // Unique symbols list for filter select
  const uniqueSymbols = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => set.add((t.symbol || "UNKNOWN").toUpperCase()));
    return Array.from(set).sort();
  }, [trades]);

  const symbolAStats = useMemo(() => {
    if (!compareSymbolA) return null;
    return analytics.symbols.find(s => s.symbol.toUpperCase() === compareSymbolA.toUpperCase()) || null;
  }, [compareSymbolA, analytics]);

  const symbolBStats = useMemo(() => {
    if (!compareSymbolB) return null;
    return analytics.symbols.find(s => s.symbol.toUpperCase() === compareSymbolB.toUpperCase()) || null;
  }, [compareSymbolB, analytics]);

  if (loading) {
    return (
      <div className="space-y-6 font-mono text-xs">
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-5 text-xs font-mono">
      {/* Performance Lab Header Banner */}
      <div className="p-5 rounded-2xl glass-card border border-dark-border flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xl">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Performance Diagnostics Lab
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
              DEEP DIAGNOSTICS
            </span>
          </h2>
          <p className="text-gray-400 text-xs mt-1">
            Institutional statistical breakdown answering "Why am I performing this way?"
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <ExportToolbar trades={filteredTrades} />
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-hover text-gray-300 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4 text-purple-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Diagnostic Navigation Tabs & Filters Bar */}
      <div className="p-3 rounded-2xl glass-card border border-dark-border space-y-3">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-dark-border">
          <div className="flex items-center gap-1.5">
            {[
              { id: "overview", label: "Overview & Classification", icon: Zap },
              { id: "symbols", label: "Symbol Diagnostics", icon: BarChart2 },
              { id: "time", label: "Time & Session Analysis", icon: Clock },
              { id: "drawdown", label: "Equity & Drawdown", icon: TrendingDown },
              { id: "compare", label: "Symbol Comparison", icon: Scale },
              { id: "replay", label: "Trade Replay Engine", icon: PlayCircle },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-purple-600 text-white shadow-glow"
                      : "text-gray-400 hover:text-white hover:bg-dark-hover"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-1 text-gray-400 font-bold shrink-0">
            <Filter className="w-3.5 h-3.5 text-purple-400" />
            <span>Filters:</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-[11px]">Symbol:</label>
            <select
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-dark-card border border-dark-border text-white focus:border-purple-500 font-bold"
            >
              <option value="ALL">All Symbols ({uniqueSymbols.length})</option>
              {uniqueSymbols.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-[11px]">Side:</label>
            <select
              value={filterSide}
              onChange={(e) => setFilterSide(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-dark-card border border-dark-border text-white focus:border-purple-500 font-bold"
            >
              <option value="ALL">All Sides</option>
              <option value="BUY">BUY / LONG</option>
              <option value="SELL">SELL / SHORT</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-[11px]">Outcome:</label>
            <select
              value={filterOutcome}
              onChange={(e) => setFilterOutcome(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-dark-card border border-dark-border text-white focus:border-purple-500 font-bold"
            >
              <option value="ALL">All Outcomes</option>
              <option value="WINS">Wins Only</option>
              <option value="LOSSES">Losses Only</option>
            </select>
          </div>

          <div className="ml-auto text-gray-400 text-[11px]">
            Showing <strong className="text-white">{filteredTrades.length}</strong> of {trades.length} trades
          </div>
        </div>
      </div>

      {/* Empty State Banner if 0 trades */}
      {trades.length === 0 ? (
        <div className="p-8 rounded-2xl glass-card border border-dark-border text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto">
            <BarChart2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Trading Data Available</h3>
          <p className="text-gray-400 text-xs max-w-md mx-auto">
            Upload your first CSV trade file or log manual trades to populate institutional statistics and diagnostic reports.
          </p>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW & CLASSIFICATION */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Trader Classification Banner */}
          <div className={`p-5 rounded-2xl border ${analytics.classification.color} flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border">
                  {analytics.classification.badge}
                </span>
                <h3 className="text-lg font-extrabold text-white tracking-tight">
                  Statistical Profile: {analytics.classification.title}
                </h3>
              </div>
              <p className="text-xs text-gray-300 max-w-2xl">
                {analytics.classification.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 shrink-0 text-right">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                <span className="text-gray-400 block text-[10px]">PROFIT FACTOR</span>
                <span className="text-white font-extrabold text-sm">{analytics.profitFactor}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                <span className="text-gray-400 block text-[10px]">AVG HOLD TIME</span>
                <span className="text-purple-300 font-extrabold text-sm">{formatDuration(analytics.avgHoldSeconds)}</span>
              </div>
            </div>
          </div>

          {/* Institutional Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-[10px] text-gray-400 block uppercase">NET PROFIT</span>
              <span className={`text-base font-extrabold block ${analytics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatSigned(analytics.netProfit)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-[10px] text-gray-400 block uppercase">WIN RATE</span>
              <span className="text-base font-extrabold text-purple-400 block">{analytics.winRate}%</span>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-[10px] text-gray-400 block uppercase">EXPECTANCY</span>
              <span className="text-base font-extrabold text-emerald-400 block">{symbol}{analytics.expectancy}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-[10px] text-gray-400 block uppercase">AVG RISK : REWARD</span>
              <span className="text-base font-extrabold text-purple-300 block">{analytics.avgRR}R</span>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-[10px] text-gray-400 block uppercase">AVG LOT SIZE</span>
              <span className="text-base font-extrabold text-gray-200 block">{analytics.avgLotSize} Lots</span>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-[10px] text-gray-400 block uppercase">AVG DAILY P&L</span>
              <span className={`text-base font-extrabold block ${analytics.avgDailyProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatSigned(analytics.avgDailyProfit)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-[10px] text-gray-400 block uppercase">LONG WIN RATE</span>
              <span className="text-base font-extrabold text-emerald-400 block">{analytics.longWinRate}%</span>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-[10px] text-gray-400 block uppercase">SHORT WIN RATE</span>
              <span className="text-base font-extrabold text-rose-400 block">{analytics.shortWinRate}%</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SYMBOL DIAGNOSTICS */}
      {activeTab === "symbols" && (
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
          <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2 border-b border-dark-border pb-3">
            <BarChart2 className="w-4 h-4 text-purple-400" />
            Symbol Performance Breakdown
          </h3>

          <div className="rounded-xl border border-dark-border overflow-x-auto bg-dark-card/60">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#0C1019] text-gray-400 border-b border-dark-border">
                <tr>
                  <th className="py-3 px-4">Symbol</th>
                  <th className="py-3 px-4">Trades</th>
                  <th className="py-3 px-4">Win Rate</th>
                  <th className="py-3 px-4">Net PnL</th>
                  <th className="py-3 px-4">Gross Profit</th>
                  <th className="py-3 px-4">Gross Loss</th>
                  <th className="py-3 px-4">Profit Factor</th>
                  <th className="py-3 px-4">Avg RR</th>
                  <th className="py-3 px-4">Avg Lot Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border text-gray-300">
                {analytics.symbols.map((s) => (
                  <tr key={s.symbol} className="hover:bg-purple-600/10 transition-colors">
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
                    <td className="py-3 px-4 text-gray-300">{s.avgLotSize} Lots</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TIME & SESSION ANALYSIS */}
      {activeTab === "time" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Session Performance */}
          <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2 border-b border-dark-border pb-3">
              <Clock className="w-4 h-4 text-purple-400" />
              Trading Session Performance
            </h3>
            <div className="space-y-2">
              {analytics.sessions.map((sess) => (
                <div key={sess.session} className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold block">{sess.session}</span>
                    <span className="text-gray-400 text-[10px]">{sess.trades} Trades • {sess.winRate}% WR</span>
                  </div>
                  <span className={`font-bold ${sess.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatSigned(sess.netProfit)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Days of Week */}
          <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2 border-b border-dark-border pb-3">
              <Calendar className="w-4 h-4 text-indigo-400" />
              Day of Week Performance
            </h3>
            <div className="space-y-2">
              {analytics.daysOfWeek.map((d) => (
                <div key={d.period} className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold block">{d.period}</span>
                    <span className="text-gray-400 text-[10px]">{d.trades} Trades • {d.winRate}% WR</span>
                  </div>
                  <span className={`font-bold ${d.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatSigned(d.netProfit)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DRAWDOWN & EQUITY */}
      {activeTab === "drawdown" && (
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
          <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            Equity Curve & Drawdown Analysis
          </h3>
          <div className="p-6 rounded-xl bg-dark-card border border-dark-border text-center space-y-2">
            <p className="text-gray-300 text-xs">
              All-time peak net profit: <strong className="text-emerald-400">{formatSigned(Math.max(...analytics.equityCurve.map(e => e.cumulativeProfit), 0))}</strong>
            </p>
            <p className="text-gray-400 text-[11px]">
              Total executions processed: {analytics.equityCurve.length}
            </p>
          </div>
        </div>
      )}

      {/* TAB 5: SYMBOL COMPARISON */}
      {activeTab === "compare" && (
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
          <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2 border-b border-dark-border pb-3">
            <Scale className="w-4 h-4 text-purple-400" />
            Side-by-Side Symbol Comparison
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 block mb-1">Select Symbol A:</label>
              <select
                value={compareSymbolA}
                onChange={(e) => setCompareSymbolA(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-dark-card border border-dark-border text-white font-bold"
              >
                <option value="">Choose Symbol A...</option>
                {uniqueSymbols.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              {symbolAStats && (
                <div className="p-4 rounded-xl bg-dark-card border border-dark-border mt-3 space-y-2">
                  <span className="text-base font-extrabold text-white block">{symbolAStats.symbol}</span>
                  <div className="flex justify-between text-gray-400"><span>Net Profit:</span><span className="text-emerald-400 font-bold">{formatSigned(symbolAStats.netProfit)}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Win Rate:</span><span className="text-purple-300 font-bold">{symbolAStats.winRate}%</span></div>
                  <div className="flex justify-between text-gray-400"><span>Profit Factor:</span><span className="text-white font-bold">{symbolAStats.profitFactor}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Avg RR:</span><span className="text-purple-400 font-bold">{symbolAStats.avgRR}R</span></div>
                </div>
              )}
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Select Symbol B:</label>
              <select
                value={compareSymbolB}
                onChange={(e) => setCompareSymbolB(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-dark-card border border-dark-border text-white font-bold"
              >
                <option value="">Choose Symbol B...</option>
                {uniqueSymbols.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              {symbolBStats && (
                <div className="p-4 rounded-xl bg-dark-card border border-dark-border mt-3 space-y-2">
                  <span className="text-base font-extrabold text-white block">{symbolBStats.symbol}</span>
                  <div className="flex justify-between text-gray-400"><span>Net Profit:</span><span className="text-emerald-400 font-bold">{formatSigned(symbolBStats.netProfit)}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Win Rate:</span><span className="text-purple-300 font-bold">{symbolBStats.winRate}%</span></div>
                  <div className="flex justify-between text-gray-400"><span>Profit Factor:</span><span className="text-white font-bold">{symbolBStats.profitFactor}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Avg RR:</span><span className="text-purple-400 font-bold">{symbolBStats.avgRR}R</span></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: TRADE REPLAY ENGINE */}
      {activeTab === "replay" && (
        <div className="p-8 rounded-2xl glass-card border border-dark-border text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto">
            <PlayCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Trade Replay Engine (Coming Soon)</h3>
          <p className="text-gray-400 text-xs max-w-md mx-auto">
            Tick-by-tick market replay for reviewing execution timing and psychological entry points will be enabled in Phase 4.
          </p>
        </div>
      )}
        </>
      )}
    </div>
  );
};
