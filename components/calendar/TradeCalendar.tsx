"use client";
// components/calendar/TradeCalendar.tsx
// TradeFourge Phase 3.2.5 — Institutional Trading Timeline & Daily Review Workspace
// Complete workstation featuring Monthly Calendar Grid, Chronological Session Timeline,
// Day Indicators, Daily Reflection Notes, Year Overview, and Slide-over Daily Review Panel.

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades, updateTrade } from "@/lib/supabase/trades";
import type { CloudTradeWithRelations } from "@/types/database";
import { CloudTradeDetailDrawer } from "@/components/trades/CloudTradeDetailDrawer";
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isSameDay, setMonth, getYear, setYear
} from "date-fns";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, TrendingUp, TrendingDown,
  RefreshCw, BarChart2, Filter, ArrowRight, X, ExternalLink, FileText, Camera, Tag as TagIcon,
  AlertTriangle, Star, Sparkles, Clock, Save, Edit3, Loader2, Layers, Check
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

type MainViewMode = "calendar" | "timeline";

export const TradeCalendar: React.FC = () => {
  const router = useRouter();
  const theme = useJournalStore((s) => s.theme);
  const { format: formatCurrency, formatSigned } = useCurrencyFormatter();
  const supabase = createClient();

  const [trades, setTrades] = useState<CloudTradeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<MainViewMode>("calendar");

  // Filters State
  const [filterSymbol, setFilterSymbol] = useState<string>("ALL");
  const [filterSide, setFilterSide] = useState<string>("ALL");

  // Daily Review Drawer State
  const [selectedDayData, setSelectedDayData] = useState<{ date: Date; dateKey: string; trades: CloudTradeWithRelations[]; pnl: number } | null>(null);
  const [activeDrawerTrade, setActiveDrawerTrade] = useState<CloudTradeWithRelations | null>(null);

  // Reflection Notes State for Daily Review Panel
  const [reflectionNotes, setReflectionNotes] = useState<string>("");
  const [savingReflection, setSavingReflection] = useState<boolean>(false);
  const [reflectionSavedToast, setReflectionSavedToast] = useState<boolean>(false);

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

  // Available symbols for select dropdown
  const availableSymbols = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => set.add((t.symbol || "UNKNOWN").toUpperCase()));
    return Array.from(set).sort();
  }, [trades]);

  // Map of trades grouped by day key ("YYYY-MM-DD")
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

  // Monthly Insights Header Summary Metrics (Section 1)
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
    let totalWinsPnl = 0;
    let totalLossesPnl = 0;
    let totalWinsCount = 0;
    let totalLossesCount = 0;
    let totalRSum = 0;
    let tradesWithR = 0;

    daysInMonth.forEach((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const dayData = tradesByDay.get(dateKey);
      if (dayData && dayData.trades.length > 0) {
        monthlyPnL += dayData.pnl;
        totalMonthTrades += dayData.trades.length;

        dayData.trades.forEach((t) => {
          const pnl = t.net_profit ?? (t.profit + t.commission + t.swap);
          if (pnl > 0) {
            totalWinsPnl += pnl;
            totalWinsCount++;
          } else if (pnl < 0) {
            totalLossesPnl += pnl;
            totalLossesCount++;
          }
          if (t.rr_ratio !== null && t.rr_ratio !== undefined) {
            totalRSum += t.rr_ratio;
            tradesWithR++;
          }
        });

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
    const avgWin = totalWinsCount > 0 ? totalWinsPnl / totalWinsCount : 0;
    const avgLoss = totalLossesCount > 0 ? totalLossesPnl / totalLossesCount : 0;
    const avgRR = tradesWithR > 0 ? (totalRSum / tradesWithR).toFixed(2) : "0.00";

    return {
      monthlyPnL,
      greenDays,
      redDays,
      beDays,
      totalMonthTrades,
      avgDailyProfit,
      avgWin,
      avgLoss,
      avgRR,
      bestDayStr: bestDayPnL !== -Infinity ? `${bestDayStr} (${formatSigned(bestDayPnL)})` : "N/A",
      worstDayStr: worstDayPnL !== Infinity ? `${worstDayStr} (${formatSigned(worstDayPnL)})` : "N/A",
    };
  }, [daysInMonth, tradesByDay, formatSigned]);

  // Year Overview Data (Section 8)
  const selectedYear = getYear(currentMonth);
  const yearlyOverviewData = useMemo(() => {
    return Array.from({ length: 12 }).map((_, monthIdx) => {
      const dateObj = new Date(selectedYear, monthIdx, 1);
      const mStart = startOfMonth(dateObj);
      const mEnd = endOfMonth(dateObj);
      const mDays = eachDayOfInterval({ start: mStart, end: mEnd });

      let pnl = 0;
      let tradesCount = 0;
      let winsCount = 0;
      let tradingDaysCount = 0;

      mDays.forEach((day) => {
        const dateKey = format(day, "yyyy-MM-dd");
        const dayData = tradesByDay.get(dateKey);
        if (dayData && dayData.trades.length > 0) {
          pnl += dayData.pnl;
          tradesCount += dayData.trades.length;
          winsCount += dayData.wins;
          tradingDaysCount++;
        }
      });

      const winRate = tradesCount > 0 ? Math.round((winsCount / tradesCount) * 100) : 0;

      return {
        monthName: format(dateObj, "MMM"),
        monthIdx,
        pnl,
        tradesCount,
        tradingDaysCount,
        winRate,
      };
    });
  }, [selectedYear, tradesByDay]);

  // Active Days for Timeline Feed (Section 7)
  const activeTimelineDays = useMemo(() => {
    const list: { day: Date; dateKey: string; data: { trades: CloudTradeWithRelations[]; pnl: number; wins: number; losses: number } }[] = [];
    daysInMonth.forEach((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const dayData = tradesByDay.get(dateKey);
      if (dayData && dayData.trades.length > 0) {
        list.push({ day, dateKey, data: dayData });
      }
    });
    return list.sort((a, b) => b.day.getTime() - a.day.getTime());
  }, [daysInMonth, tradesByDay]);

  // Handle Save Reflection Notes in Daily Review Panel
  const handleSaveReflection = async () => {
    if (!selectedDayData || selectedDayData.trades.length === 0) return;
    setSavingReflection(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Save reflection notes to the primary trade of that day
        const primaryTrade = selectedDayData.trades[0];
        await updateTrade(primaryTrade.id, user.id, { notes: reflectionNotes.trim() || null });
        setReflectionSavedToast(true);
        setTimeout(() => setReflectionSavedToast(false), 3000);
        loadTrades();
      }
    } catch (err) {
      console.error("Save reflection error:", err);
    } finally {
      setSavingReflection(false);
    }
  };

  const formatDuration = (secs: number | null): string => {
    if (!secs) return "—";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="space-y-6 text-xs font-mono max-w-7xl mx-auto pb-16">
      {/* ── SECTION 1: Month Header & Quick Statistics ─────────────────────── */}
      <div className="p-5 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Trading Timeline & Daily Review Workspace
                <span className="text-xs px-2.5 py-0.5 rounded bg-purple-600/20 text-purple-300 border border-purple-500/30">
                  {format(currentMonth, "MMMM yyyy")}
                </span>
              </h1>
              <p className="text-xs text-gray-400">
                Institutional daily session diary, trade timeline, and daily reflections.
              </p>
            </div>
          </div>

          {/* View Switcher & Month Navigation Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Calendar vs Timeline Mode Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                  viewMode === "calendar" ? "bg-purple-600 text-white shadow-glow" : "text-gray-400 hover:text-white"
                }`}
              >
                Calendar Grid
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                  viewMode === "timeline" ? "bg-purple-600 text-white shadow-glow" : "text-gray-400 hover:text-white"
                }`}
              >
                Session Timeline
              </button>
            </div>

            {/* Symbol & Side Filters */}
            <select
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-gray-300 focus:outline-none focus:border-purple-500"
            >
              <option value="ALL">All Symbols</option>
              {availableSymbols.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={filterSide}
              onChange={(e) => setFilterSide(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-gray-300 focus:outline-none focus:border-purple-500"
            >
              <option value="ALL">All Directions</option>
              <option value="BUY">Buy / Long</option>
              <option value="SELL">Sell / Short</option>
            </select>

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
                className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-glow"
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

        {/* Quick Statistics KPI Header Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">MONTHLY NET PROFIT</span>
            <span className={`text-sm font-extrabold block truncate ${monthlyInsights.monthlyPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatSigned(monthlyInsights.monthlyPnL)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">WIN / LOSS DAYS</span>
            <span className="text-sm font-extrabold text-white block">
              <span className="text-emerald-400">{monthlyInsights.greenDays}W</span> / <span className="text-rose-400">{monthlyInsights.redDays}L</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">TOTAL TRADES</span>
            <span className="text-sm font-extrabold text-purple-400 block">{monthlyInsights.totalMonthTrades}</span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">AVG DAILY PROFIT</span>
            <span className={`text-sm font-extrabold block truncate ${monthlyInsights.avgDailyProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatSigned(monthlyInsights.avgDailyProfit)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">BEST / WORST DAY</span>
            <span className="text-[11px] font-bold text-emerald-400 block truncate">{monthlyInsights.bestDayStr}</span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">AVG R:R RATIO</span>
            <span className="text-sm font-extrabold text-indigo-400 block">{monthlyInsights.avgRR} R</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2 & 3: Monthly Trading Calendar Grid ───────────────────── */}
      {viewMode === "calendar" ? (
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

          {/* Month Grid Cells */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty padding cells */}
            {Array.from({ length: startDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-24 sm:h-28 rounded-xl bg-white/[0.02] border border-white/5 opacity-40" />
            ))}

            {/* Month Days */}
            {daysInMonth.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayData = tradesByDay.get(dateKey);
              const tradeCount = dayData?.trades.length || 0;
              const pnl = dayData?.pnl || 0;
              const isToday = isSameDay(day, new Date());

              // Indicators for Day Card (Section 3)
              const hasNotes = dayData?.trades.some((t) => !!(t.notes || t.emotions || t.lessons));
              const hasImages = dayData?.trades.some((t) => (t.images || []).length > 0);
              const hasTags = dayData?.trades.some((t) => (t.tags || []).length > 0);

              return (
                <div
                  key={dateKey}
                  onClick={() => {
                    setSelectedDayData({ date: day, dateKey, trades: dayData?.trades || [], pnl });
                    if (dayData?.trades[0]?.notes) {
                      setReflectionNotes(dayData.trades[0].notes);
                    } else {
                      setReflectionNotes("");
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

                    {/* Day Indicators Badges (Section 3) */}
                    <div className="flex items-center gap-1">
                      {hasNotes && <span title="Has journal notes"><FileText className="w-3 h-3 text-purple-400" /></span>}
                      {hasImages && <span title="Has screenshots"><Camera className="w-3 h-3 text-emerald-400" /></span>}
                      {hasTags && <span title="Has strategy tags"><TagIcon className="w-3 h-3 text-indigo-400" /></span>}
                    </div>
                  </div>

                  {tradeCount > 0 ? (
                    <div className="space-y-0.5">
                      <span className={`text-xs sm:text-sm font-extrabold block truncate ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatSigned(pnl)}
                      </span>
                      <span className="text-[9px] text-gray-400 block font-bold">
                        {tradeCount} Trade{tradeCount > 1 ? "s" : ""}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[9px] text-gray-600 block italic">No Trades</span>
                  )}

                  {/* Day Hover Tooltip */}
                  {tradeCount > 0 && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-52 p-3 rounded-xl bg-[#0B0F19] border border-purple-500/30 text-white text-[11px] shadow-2xl space-y-1">
                      <p className="font-bold text-purple-300 border-b border-white/10 pb-1">{format(day, "EEEE, MMM dd, yyyy")}</p>
                      <div className="space-y-0.5 text-gray-300 text-[10px]">
                        <div className="flex justify-between"><span>Executed Trades:</span><span className="text-white font-bold">{tradeCount}</span></div>
                        <div className="flex justify-between"><span>Wins / Losses:</span><span className="text-emerald-400 font-bold">{(dayData?.wins || 0)}W / {(dayData?.losses || 0)}L</span></div>
                        <div className="flex justify-between"><span>Net PnL:</span><span className={`font-bold ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatSigned(pnl)}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── SECTION 7: Chronological Timeline View ───────────────────────── */
        <div className="space-y-4">
          {activeTimelineDays.map(({ day, dateKey, data }) => (
            <div
              key={dateKey}
              onClick={() => {
                setSelectedDayData({ date: day, dateKey, trades: data.trades, pnl: data.pnl });
                if (data.trades[0]?.notes) setReflectionNotes(data.trades[0].notes);
                else setReflectionNotes("");
              }}
              className="p-5 rounded-2xl bg-[#111726] border border-white/10 hover:border-purple-500/40 cursor-pointer space-y-3 shadow-2xl transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-sm">{format(day, "EEEE, MMMM dd, yyyy")}</span>
                  <span className="px-2 py-0.5 rounded bg-purple-600/20 text-purple-300 border border-purple-500/30 text-xs font-bold">
                    {data.trades.length} Trade{data.trades.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-base font-extrabold ${data.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatSigned(data.pnl)}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
                </div>
              </div>

              {/* Trade Preview Row */}
              <div className="flex flex-wrap gap-2">
                {data.trades.map((t) => (
                  <span key={t.id} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-300 flex items-center gap-1.5 font-mono">
                    <span className="font-bold text-white">{t.symbol}</span>
                    <span className={t.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {formatSigned(t.net_profit)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}

          {activeTimelineDays.length === 0 && (
            <div className="p-12 text-center text-gray-500 border border-dashed border-white/10 rounded-2xl">
              No trading sessions recorded for {format(currentMonth, "MMMM yyyy")}.
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 8: Year Overview Breakdown ────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-purple-400" />
              {selectedYear} Yearly Performance Breakdown
            </h2>
            <p className="text-xs text-gray-400">Monthly PnL distribution, active trading days, and win rates.</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentMonth(setYear(currentMonth, selectedYear - 1))}
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white"
            >
              {selectedYear - 1}
            </button>
            <span className="px-3 py-1 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30 font-bold">
              {selectedYear}
            </span>
            <button
              onClick={() => setCurrentMonth(setYear(currentMonth, selectedYear + 1))}
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white"
            >
              {selectedYear + 1}
            </button>
          </div>
        </div>

        {/* 12 Months Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {yearlyOverviewData.map((m) => (
            <div
              key={m.monthIdx}
              onClick={() => setCurrentMonth(setMonth(currentMonth, m.monthIdx))}
              className={`p-3.5 rounded-xl border cursor-pointer hover:border-purple-500/50 transition-all ${
                m.pnl > 0
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : m.pnl < 0
                  ? "bg-rose-500/10 border-rose-500/30"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <span className="font-bold text-white block">{m.monthName}</span>
              <span className={`text-sm font-extrabold block truncate ${m.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatSigned(m.pnl)}
              </span>
              <span className="text-[10px] text-gray-400 block mt-1">
                {m.tradingDaysCount} Days • {m.winRate}% Win
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 4, 5 & 6: Slide-Over Daily Review Panel ───────────────── */}
      <AnimatePresence>
        {selectedDayData && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDayData(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative z-10 w-full md:max-w-xl bg-[#0F1523] border-l border-white/10 h-full overflow-y-auto p-6 space-y-5 shadow-2xl text-xs font-mono"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-xl font-extrabold text-white">
                    Daily Review: {format(selectedDayData.date, "EEEE, MMMM dd, yyyy")}
                  </h3>
                  <span className={`text-xs font-bold ${selectedDayData.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    Session Net PnL: {formatSigned(selectedDayData.pnl)}
                  </span>
                </div>

                <button onClick={() => setSelectedDayData(null)} className="p-2 rounded-xl text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Day Metrics Grid (Section 4) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-gray-400 block uppercase">EXECUTED TRADES</span>
                  <span className="text-white font-bold">{selectedDayData.trades.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-gray-400 block uppercase">SESSION P&L</span>
                  <span className={`font-bold ${selectedDayData.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatSigned(selectedDayData.pnl)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-gray-400 block uppercase">SYMBOLS TRADED</span>
                  <span className="text-purple-300 font-bold truncate block">
                    {Array.from(new Set(selectedDayData.trades.map((t) => t.symbol))).join(", ") || "None"}
                  </span>
                </div>
              </div>

              {/* Trade List Table (Section 5) */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider text-gray-400">Executed Trades</h4>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {selectedDayData.trades.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setActiveDrawerTrade(t);
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
                          {t.close_time ? format(parseISO(t.close_time), "HH:mm:ss") : "—"} • Duration: {formatDuration(t.duration_seconds)}
                        </span>
                      </div>

                      <span className={`font-extrabold ${t.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatSigned(t.net_profit)}
                      </span>
                    </div>
                  ))}
                  {selectedDayData.trades.length === 0 && (
                    <div className="p-4 text-center text-gray-500 italic">No trades recorded on this date.</div>
                  )}
                </div>
              </div>

              {/* Daily Reflection & Notes (Section 6) */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-400" />
                    Daily Reflection & Mindset Notes
                  </label>
                  {reflectionSavedToast && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Cloud Saved!
                    </span>
                  )}
                </div>

                <textarea
                  rows={4}
                  value={reflectionNotes}
                  onChange={(e) => setReflectionNotes(e.target.value)}
                  placeholder="How was your mindset today? Did you follow your trading plan? Lessons learned..."
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-purple-500 font-mono text-xs"
                />

                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleSaveReflection}
                    disabled={savingReflection || selectedDayData.trades.length === 0}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingReflection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Daily Reflection</span>
                  </button>
                </div>
              </div>

              {/* ── PART D: TradeFourge AI Coach (Future Architecture Preview) ──── */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-900/30 via-indigo-900/20 to-black border border-purple-500/30 space-y-3 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="font-extrabold text-white text-xs">🧠 TradeFourge AI Coach</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-300 border border-purple-500/40 text-[9px] font-bold uppercase tracking-wider">
                    Future AI Mentor
                  </span>
                </div>

                <p className="text-[11px] text-gray-300 leading-relaxed font-sans">
                  Your personal AI trading mentor. After every trading day, TradeFourge AI Coach will analyze your trading behavior, identify recurring mistakes, measure discipline, evaluate consistency, and provide personalized coaching.
                </p>

                {/* Simulated AI Scores & Metrics Preview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-center">
                    <span className="text-[9px] text-gray-400 block uppercase">DISCIPLINE</span>
                    <span className="text-xs font-bold text-emerald-400">91 / 100</span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-center">
                    <span className="text-[9px] text-gray-400 block uppercase">CONSISTENCY</span>
                    <span className="text-xs font-bold text-purple-300">87 / 100</span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-center">
                    <span className="text-[9px] text-gray-400 block uppercase">RISK RATING</span>
                    <span className="text-xs font-bold text-indigo-300">Excellent</span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-center">
                    <span className="text-[9px] text-gray-400 block uppercase">OVERALL</span>
                    <span className="text-xs font-bold text-amber-400">Grade A</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-[10px] text-purple-300 space-y-1">
                  <span className="font-bold block text-white">Next Focus Recommendation:</span>
                  <p className="text-gray-300">Limit daily execution to 3 high-confluence trades during London session to prevent overtrading.</p>
                </div>
              </div>

              {/* Direct Journal Navigation Shortcut */}
              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => {
                    router.push(`/journal?search=${selectedDayData.dateKey}`);
                    setSelectedDayData(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1.5"
                >
                  <span>Open Filtered Trade Journal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
