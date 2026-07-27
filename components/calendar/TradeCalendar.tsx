"use client";
// components/calendar/TradeCalendar.tsx
// TradeFourge Phase 3.2.5 — Institutional Trading Calendar & GitHub Contribution Heatmap
// Features monthly/weekly views, GitHub-style PnL heatmap, monthly summary metrics, 
// session overlays, hover cards, interactive day drawer, and future replay architecture hooks.

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades } from "@/lib/supabase/trades";
import type { CloudTradeWithRelations } from "@/types/database";
import { CloudTradeDetailDrawer } from "@/components/trades/CloudTradeDetailDrawer";
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isSameDay, isSameMonth, subDays, eachWeekOfInterval, endOfWeek, startOfWeek
} from "date-fns";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, TrendingUp, TrendingDown, RefreshCw,
  Sparkles, Layers, Grid, Flame, ArrowRight, ExternalLink, Filter, PlayCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type CalendarViewMode = "month" | "heatmap" | "week";

export const TradeCalendar: React.FC = () => {
  const router = useRouter();
  const theme = useJournalStore((s) => s.theme);
  const { format: formatCurrency, formatSigned } = useCurrencyFormatter();
  const supabase = createClient();

  const [trades, setTrades] = useState<CloudTradeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");

  // Session Overlay State
  const [sessionOverlay, setSessionOverlay] = useState<boolean>(false);

  // Filters State
  const [filterSymbol, setFilterSymbol] = useState<string>("ALL");
  const [filterSide, setFilterSide] = useState<string>("ALL");

  // Selection for Day Drawer / Detail view
  const [selectedDayData, setSelectedDayData] = useState<{ date: Date; dateKey: string; trades: CloudTradeWithRelations[]; pnl: number } | null>(null);
  const [activeDrawerTrade, setActiveDrawerTrade] = useState<CloudTradeWithRelations | null>(null);

  const isLight = theme === "light";

  const loadTrades = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await fetchTrades(user.id, {}, 1, 10000, "close_time", false);
        if (data?.data) {
          setTrades(data.data);
        }
      }
    } catch (err) {
      console.error("Calendar load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrades();
  }, []);

  // Filtered trades list
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (filterSymbol !== "ALL" && t.symbol.toUpperCase() !== filterSymbol.toUpperCase()) return false;
      if (filterSide !== "ALL" && t.side.toUpperCase() !== filterSide.toUpperCase()) return false;
      return true;
    });
  }, [trades, filterSymbol, filterSide]);

  // Unique symbols for filter select
  const availableSymbols = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => set.add((t.symbol || "UNKNOWN").toUpperCase()));
    return Array.from(set).sort();
  }, [trades]);

  // Date map of trades by day key ("YYYY-MM-DD")
  const tradesByDay = useMemo(() => {
    const map = new Map<string, { trades: CloudTradeWithRelations[]; pnl: number; wins: number; losses: number }>();
    filteredTrades.forEach((t) => {
      const closeStr = t.close_time || t.open_time || t.created_at;
      if (!closeStr) return;
      const dateKey = format(parseISO(closeStr), "yyyy-MM-dd");
      const existing = map.get(dateKey) || { trades: [], pnl: 0, wins: 0, losses: 0 };
      const netPnl = t.net_profit ?? (t.profit + t.commission + t.swap);
      existing.trades.push(t);
      existing.pnl += netPnl;
      if (netPnl > 0) existing.wins++;
      else if (netPnl < 0) existing.losses++;
      map.set(dateKey, existing);
    });
    return map;
  }, [filteredTrades]);

  // Monthly View Intervals
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  // Monthly Insights Header Summary Metrics
  const monthlyInsights = useMemo(() => {
    let monthlyPnL = 0;
    let greenDays = 0;
    let redDays = 0;
    let beDays = 0;
    let totalMonthTrades = 0;
    let bestDayPnL = -Infinity;
    let bestDayStr = "N/A";
    let worstDayPnL = Infinity;
    let worstDayStr = "N/A";

    daysInMonth.forEach((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const dayData = tradesByDay.get(dateKey);
      if (dayData && dayData.trades.length > 0) {
        monthlyPnL += dayData.pnl;
        totalMonthTrades += dayData.trades.length;
        if (dayData.pnl > 0) {
          greenDays++;
          if (dayData.pnl > bestDayPnL) {
            bestDayPnL = dayData.pnl;
            bestDayStr = format(day, "MMM dd");
          }
        } else if (dayData.pnl < 0) {
          redDays++;
          if (dayData.pnl < worstDayPnL) {
            worstDayPnL = dayData.pnl;
            worstDayStr = format(day, "MMM dd");
          }
        } else {
          beDays++;
        }
      }
    });

    const activeDaysCount = greenDays + redDays + beDays;
    const avgDailyProfit = activeDaysCount > 0 ? monthlyPnL / activeDaysCount : 0;

    return {
      monthlyPnL,
      greenDays,
      redDays,
      beDays,
      totalMonthTrades,
      avgDailyProfit,
      bestDayStr: bestDayPnL !== -Infinity ? `${bestDayStr} (${formatSigned(bestDayPnL)})` : "N/A",
      worstDayStr: worstDayPnL !== Infinity ? `${worstDayStr} (${formatSigned(worstDayPnL)})` : "N/A",
    };
  }, [daysInMonth, tradesByDay, formatSigned]);

  // GitHub Heatmap 365 Days Grid
  const heatmapDays = useMemo(() => {
    const today = new Date();
    const startDate = subDays(today, 364);
    return eachDayOfInterval({ start: startDate, end: today });
  }, []);

  // Helper for Heatmap Color Intensity
  const getHeatmapColor = (pnl: number, tradeCount: number) => {
    if (tradeCount === 0) return isLight ? "bg-[#F1F5F9] border-gray-200" : "bg-[#161D2F] border-white/5";
    if (pnl > 500) return "bg-emerald-600 text-white shadow-sm border-emerald-500";
    if (pnl > 0) return "bg-emerald-500/40 text-emerald-300 border-emerald-500/50";
    if (pnl === 0) return "bg-gray-500/40 text-gray-300 border-gray-400/50";
    if (pnl > -500) return "bg-rose-500/40 text-rose-300 border-rose-500/50";
    return "bg-rose-600 text-white shadow-sm border-rose-500";
  };

  return (
    <div className="space-y-6 text-xs font-mono max-w-7xl mx-auto pb-16">
      {/* ── PART 4: Monthly Insights Summary Banner ──────────────────────── */}
      <div className="p-5 rounded-2xl bg-[#111726] border border-white/10 space-y-3 shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Trading Calendar & Heatmap
                <span className="text-xs px-2 py-0.5 rounded bg-purple-600/20 text-purple-300 border border-purple-500/30">
                  {format(currentMonth, "MMMM yyyy")}
                </span>
              </h1>
              <p className="text-xs text-gray-400">
                Visual session calendar, performance heatmaps, and day-level trade inspection.
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
              <button
                onClick={() => setViewMode("month")}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                  viewMode === "month" ? "bg-purple-600 text-white shadow-glow" : "text-gray-400 hover:text-white"
                }`}
              >
                Month Grid
              </button>
              <button
                onClick={() => setViewMode("heatmap")}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                  viewMode === "heatmap" ? "bg-purple-600 text-white shadow-glow" : "text-gray-400 hover:text-white"
                }`}
              >
                GitHub Heatmap
              </button>
            </div>

            {/* Session Overlay Toggle */}
            <button
              onClick={() => setSessionOverlay(!sessionOverlay)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                sessionOverlay ? "bg-purple-600 text-white border-purple-500" : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
              }`}
            >
              Session Overlay {sessionOverlay ? "ON" : "OFF"}
            </button>

            {/* Month Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Monthly Summary KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">MONTHLY P&L</span>
            <span className={`text-sm font-extrabold block truncate ${monthlyInsights.monthlyPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatSigned(monthlyInsights.monthlyPnL)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">WINNING DAYS</span>
            <span className="text-sm font-extrabold text-emerald-400 block">{monthlyInsights.greenDays} Days</span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">LOSING DAYS</span>
            <span className="text-sm font-extrabold text-rose-400 block">{monthlyInsights.redDays} Days</span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">BREAKEVEN DAYS</span>
            <span className="text-sm font-extrabold text-gray-300 block">{monthlyInsights.beDays} Days</span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">TOTAL TRADES</span>
            <span className="text-sm font-extrabold text-purple-400 block">{monthlyInsights.totalMonthTrades}</span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">AVG DAILY P&L</span>
            <span className={`text-sm font-extrabold block truncate ${monthlyInsights.avgDailyProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatSigned(monthlyInsights.avgDailyProfit)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">BEST DAY</span>
            <span className="text-xs font-bold text-emerald-400 block truncate">{monthlyInsights.bestDayStr}</span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">WORST DAY</span>
            <span className="text-xs font-bold text-rose-400 block truncate">{monthlyInsights.worstDayStr}</span>
          </div>
        </div>
      </div>

      {/* ── PART 3: GitHub Contribution Style Heatmap View ──────────────── */}
      {viewMode === "heatmap" ? (
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-purple-400" />
              Annual Contribution Heatmap (365 Days)
            </h2>
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <span>Less</span>
              <div className="flex gap-1">
                <span className="w-3 h-3 rounded bg-rose-600" />
                <span className="w-3 h-3 rounded bg-rose-500/40" />
                <span className="w-3 h-3 rounded bg-white/5" />
                <span className="w-3 h-3 rounded bg-emerald-500/40" />
                <span className="w-3 h-3 rounded bg-emerald-600" />
              </div>
              <span>More PnL</span>
            </div>
          </div>

          {/* Heatmap Grid Matrix */}
          <div className="overflow-x-auto pb-2">
            <div className="inline-grid grid-rows-7 grid-flow-col gap-1.5">
              {heatmapDays.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayData = tradesByDay.get(dateKey);
                const tradeCount = dayData?.trades.length || 0;
                const pnl = dayData?.pnl || 0;
                const colorClass = getHeatmapColor(pnl, tradeCount);

                return (
                  <div
                    key={dateKey}
                    onClick={() => {
                      if (dayData) {
                        setSelectedDayData({ date: day, dateKey, trades: dayData.trades, pnl });
                      } else {
                        router.push(`/journal?search=${dateKey}`);
                      }
                    }}
                    className={`w-3.5 h-3.5 rounded-sm border cursor-pointer hover:scale-125 transition-all duration-150 group relative ${colorClass}`}
                  >
                    {/* Rich Hover Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2.5 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
                      <p className="font-bold text-purple-300 border-b border-white/10 pb-1">{format(day, "MMM dd, yyyy")}</p>
                      <div className="space-y-0.5 text-gray-300">
                        <div className="flex justify-between">
                          <span>Trades:</span>
                          <span className="text-white font-bold">{tradeCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Net PnL:</span>
                          <span className={`font-bold ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatSigned(pnl)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ── PART 2: Monthly Calendar Grid View ──────────────────────────── */
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
          {/* Day Name Headers */}
          <div className="grid grid-cols-7 gap-2 text-center text-gray-400 font-bold uppercase text-[10px] pb-2 border-b border-white/10">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty padding cells for start of month */}
            {Array.from({ length: startDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-24 sm:h-28 rounded-xl bg-white/[0.02] border border-white/5 opacity-40" />
            ))}

            {/* Days in Month */}
            {daysInMonth.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayData = tradesByDay.get(dateKey);
              const tradeCount = dayData?.trades.length || 0;
              const pnl = dayData?.pnl || 0;
              const isToday = isSameDay(day, new Date());

              // Dominant Session calculation for Session Overlay
              const dominantSession = dayData?.trades[0]?.session || "Standard";

              return (
                <div
                  key={dateKey}
                  onClick={() => {
                    if (dayData) {
                      setSelectedDayData({ date: day, dateKey, trades: dayData.trades, pnl });
                    } else {
                      router.push(`/journal?search=${dateKey}`);
                    }
                  }}
                  className={`h-24 sm:h-28 rounded-2xl p-2.5 border transition-all duration-200 cursor-pointer flex flex-col justify-between group relative ${
                    isToday
                      ? "border-purple-500 ring-2 ring-purple-500/30 bg-purple-600/10"
                      : tradeCount > 0
                      ? pnl > 0
                        ? "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60"
                        : pnl < 0
                        ? "bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60"
                        : "bg-gray-500/10 border-gray-500/30"
                      : "bg-white/5 border-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-xs ${isToday ? "text-purple-400" : "text-white"}`}>
                      {format(day, "d")}
                    </span>

                    {sessionOverlay && tradeCount > 0 && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-600/20 text-purple-300 border border-purple-500/30">
                        {dominantSession}
                      </span>
                    )}
                  </div>

                  {tradeCount > 0 ? (
                    <div className="space-y-1">
                      <span className={`text-xs sm:text-sm font-extrabold block truncate ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatSigned(pnl)}
                      </span>
                      <span className="text-[9px] text-gray-400 block font-bold">
                        {tradeCount} trade{tradeCount > 1 ? "s" : ""}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[9px] text-gray-600 block italic">No trades</span>
                  )}

                  {/* Rich Hover Card */}
                  {tradeCount > 0 && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
                      <p className="font-bold text-purple-300 border-b border-white/10 pb-1">{format(day, "EEEE, MMM dd, yyyy")}</p>
                      <div className="space-y-0.5 text-gray-300 text-[10px]">
                        <div className="flex justify-between"><span>Executed Trades:</span><span className="text-white font-bold">{tradeCount}</span></div>
                        <div className="flex justify-between"><span>Wins / Losses:</span><span className="text-emerald-400 font-bold">{(dayData?.wins || 0)}W / {(dayData?.losses || 0)}L</span></div>
                        <div className="flex justify-between"><span>Net PnL:</span><span className={`font-bold ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatSigned(pnl)}</span></div>
                      </div>
                      <p className="text-[10px] text-purple-400 font-bold pt-1">Click to inspect day trades →</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Day Trade Modal / Inspector Drawer ────────────────────────────── */}
      {selectedDayData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-[#0F1523] border border-white/10 shadow-2xl space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Trades for {format(selectedDayData.date, "EEEE, MMMM dd, yyyy")}
                </h3>
                <span className={`text-xs font-bold ${selectedDayData.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  Day Net PnL: {formatSigned(selectedDayData.pnl)}
                </span>
              </div>
              <button onClick={() => setSelectedDayData(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {selectedDayData.trades.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setActiveDrawerTrade(t);
                    setSelectedDayData(null);
                  }}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/40 cursor-pointer flex items-center justify-between transition-colors"
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
                      {t.close_time ? format(parseISO(t.close_time), "HH:mm:ss") : "—"}
                    </span>
                  </div>

                  <span className={`font-extrabold ${t.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatSigned(t.net_profit)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => {
                  router.push(`/journal?search=${selectedDayData.dateKey}`);
                  setSelectedDayData(null);
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5"
              >
                <span>Filter Journal for Day</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Trade Detail Drawer */}
      {activeDrawerTrade && (
        <CloudTradeDetailDrawer
          trade={activeDrawerTrade}
          onClose={() => setActiveDrawerTrade(null)}
          onRefresh={() => {
            setActiveDrawerTrade(null);
            loadTrades();
          }}
        />
      )}
    </div>
  );
};
