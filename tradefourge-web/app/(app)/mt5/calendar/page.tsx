"use client";

import React, { useState, useMemo } from "react";
import { useMT5Companion } from "@/context/MT5CompanionContext";
import { MT5Header } from "@/components/mt5/MT5Header";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
  TrendingUp,
  Award,
  AlertTriangle,
  Zap,
} from "lucide-react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDaysInMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { useTheme } from "@/context/ThemeContext";

interface DayAggregation {
  dateStr: string;
  dayNum: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  netPnl: number;
}

export default function MT5CalendarPage() {
  const { trades, isLoading } = useMT5Companion();
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayAggregation | null>(null);
  const [summaryViewMode, setSummaryViewMode] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Aggregate closed trades by close date (yyyy-MM-dd)
  const tradesByDayMap = useMemo(() => {
    const map = new Map<string, DayAggregation & { dayTrades: typeof trades }>();

    trades.forEach((t) => {
      if (t.status !== "CLOSED") return;
      const targetTime = t.closeTime || t.openTime;
      if (!targetTime) return;

      const dayKey = targetTime.split("T")[0];
      const netPnl = t.profit + (t.commission || 0) + (t.swap || 0);

      const existing = map.get(dayKey) || {
        dateStr: dayKey,
        dayNum: parseInt(dayKey.split("-")[2], 10),
        totalTrades: 0,
        winCount: 0,
        lossCount: 0,
        netPnl: 0,
        dayTrades: [],
      };

      existing.totalTrades += 1;
      existing.netPnl += netPnl;
      existing.dayTrades.push(t);

      if (netPnl >= 0) {
        existing.winCount += 1;
      } else {
        existing.lossCount += 1;
      }

      map.set(dayKey, existing);
    });

    return map;
  }, [trades]);

  // Calendar cells generation
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Monthly summary calculations
  const monthlySummary = useMemo(() => {
    const currentMonthKey = format(currentDate, "yyyy-MM");
    let totalPnl = 0;
    let totalTrades = 0;
    let winDays = 0;
    let lossDays = 0;
    let bestDay = -Infinity;
    let worstDay = Infinity;

    tradesByDayMap.forEach((dayData, dayKey) => {
      if (dayKey.startsWith(currentMonthKey)) {
        totalPnl += dayData.netPnl;
        totalTrades += dayData.totalTrades;
        if (dayData.netPnl >= 0) winDays++;
        else lossDays++;

        if (dayData.netPnl > bestDay) bestDay = dayData.netPnl;
        if (dayData.netPnl < worstDay) worstDay = dayData.netPnl;
      }
    });

    const activeDays = winDays + lossDays;
    const winRate = activeDays > 0 ? (winDays / activeDays) * 100 : 0;

    return {
      totalPnl,
      totalTrades,
      winRate: winRate.toFixed(1),
      bestDay: bestDay === -Infinity ? 0 : bestDay,
      worstDay: worstDay === Infinity ? 0 : worstDay,
    };
  }, [tradesByDayMap, currentDate]);

  // Yearly summary calculations
  const yearlySummary = useMemo(() => {
    const yearKey = year.toString();
    let totalPnl = 0;
    let totalTrades = 0;
    let winDays = 0;
    let lossDays = 0;
    const monthPnlMap = new Map<string, number>();

    tradesByDayMap.forEach((dayData, dayKey) => {
      if (dayKey.startsWith(yearKey)) {
        totalPnl += dayData.netPnl;
        totalTrades += dayData.totalTrades;
        if (dayData.netPnl >= 0) winDays++;
        else lossDays++;

        const mKey = dayKey.substring(0, 7);
        monthPnlMap.set(mKey, (monthPnlMap.get(mKey) || 0) + dayData.netPnl);
      }
    });

    let bestMonth = { name: "N/A", pnl: 0 };
    let worstMonth = { name: "N/A", pnl: 0 };

    monthPnlMap.forEach((pnl, mKey) => {
      try {
        const parsed = parseISO(`${mKey}-01`);
        const mName = format(parsed, "MMMM");
        if (pnl > bestMonth.pnl) bestMonth = { name: mName, pnl };
        if (pnl < worstMonth.pnl) worstMonth = { name: mName, pnl };
      } catch {}
    });

    return {
      totalPnl,
      totalTrades,
      winDays,
      lossDays,
      bestMonth,
      worstMonth,
    };
  }, [tradesByDayMap, year]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-28 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse" />
        <div className="h-96 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse" />
      </div>
    );
  }

  // Padding days for starting day of week
  const startDayOfWeek = startOfMonth(currentDate).getDay(); // 0 is Sunday
  // Adjust so Monday is 0
  const leadingPadding = (startDayOfWeek + 6) % 7;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <MT5Header
        title="MT5 TRADING CALENDAR"
        subtitle="Daily P/L Aggregation, Win Rate Metrics & Monthly / Yearly Performance"
      />

      {/* View Mode & Month Selector Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl border bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.06] font-mono text-xs">
        {/* Month / Year Navigator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className={`p-2 rounded-xl border transition-colors ${
                isLight ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-100" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-sm font-bold font-sans px-3 min-w-[140px] text-center">
              {format(currentDate, "MMMM yyyy")}
            </span>

            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className={`p-2 rounded-xl border transition-colors ${
                isLight ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-100" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Select Dropdowns */}
          <select
            value={year}
            onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value, 10), month, 1))}
            className={`px-3 py-1.5 rounded-xl border font-bold outline-none ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-[#0F141C] border-white/[0.1] text-white"
            }`}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={month}
            onChange={(e) => setCurrentDate(new Date(year, parseInt(e.target.value, 10), 1))}
            className={`px-3 py-1.5 rounded-xl border font-bold outline-none ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-[#0F141C] border-white/[0.1] text-white"
            }`}
          >
            {[
              "January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"
            ].map((mName, idx) => (
              <option key={mName} value={idx}>
                {mName}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10">
          <button
            onClick={() => setSummaryViewMode("MONTHLY")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              summaryViewMode === "MONTHLY"
                ? isLight
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-gray-400"
            }`}
          >
            Monthly Summary
          </button>

          <button
            onClick={() => setSummaryViewMode("YEARLY")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              summaryViewMode === "YEARLY"
                ? isLight
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-gray-400"
            }`}
          >
            Yearly Summary
          </button>
        </div>
      </div>

      {/* Summary Cards Row */}
      {summaryViewMode === "MONTHLY" ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
          <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Monthly P/L</span>
            <strong className={`text-base sm:text-lg font-extrabold ${monthlySummary.totalPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {monthlySummary.totalPnl >= 0 ? "+" : ""}${monthlySummary.totalPnl.toFixed(2)}
            </strong>
          </div>

          <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Monthly Trades</span>
            <strong className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              {monthlySummary.totalTrades} trades
            </strong>
          </div>

          <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Day Win Rate</span>
            <strong className="text-base sm:text-lg font-extrabold text-blue-500">
              {monthlySummary.winRate}%
            </strong>
          </div>

          <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Best Day</span>
            <strong className="text-base sm:text-lg font-extrabold text-emerald-500">
              +${monthlySummary.bestDay.toFixed(2)}
            </strong>
          </div>

          <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Worst Day</span>
            <strong className="text-base sm:text-lg font-extrabold text-rose-500">
              -${Math.abs(monthlySummary.worstDay).toFixed(2)}
            </strong>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 font-mono">
          <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Yearly P/L ({year})</span>
            <strong className={`text-base font-extrabold ${yearlySummary.totalPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {yearlySummary.totalPnl >= 0 ? "+" : ""}${yearlySummary.totalPnl.toFixed(2)}
            </strong>
          </div>

          <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Total Trades</span>
            <strong className="text-base font-extrabold text-slate-900 dark:text-white">{yearlySummary.totalTrades}</strong>
          </div>

          <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Winning Days</span>
            <strong className="text-base font-extrabold text-emerald-500">{yearlySummary.winDays} days</strong>
          </div>

          <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Losing Days</span>
            <strong className="text-base font-extrabold text-rose-500">{yearlySummary.lossDays} days</strong>
          </div>

          <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Best Month</span>
            <strong className="text-xs font-bold text-emerald-500 block truncate">{yearlySummary.bestMonth.name}</strong>
            <span className="text-[10px] text-emerald-600">+${yearlySummary.bestMonth.pnl.toFixed(2)}</span>
          </div>

          <div className={`p-4 rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
            <span className="text-[10px] text-slate-500 dark:text-gray-400 block">Worst Month</span>
            <strong className="text-xs font-bold text-rose-500 block truncate">{yearlySummary.worstMonth.name}</strong>
            <span className="text-[10px] text-rose-500">${yearlySummary.worstMonth.pnl.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Main Calendar Grid */}
      <div
        className={`p-5 sm:p-7 rounded-3xl border shadow-xl space-y-4 ${
          isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
        }`}
      >
        {/* Day of Week Labels */}
        <div className="grid grid-cols-7 gap-2 text-center font-mono text-xs font-bold border-b pb-3 border-slate-200 dark:border-white/[0.08]">
          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
            <div key={d} className="text-slate-400 dark:text-gray-500">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid Cells */}
        <div className="grid grid-cols-7 gap-2 sm:gap-3 font-mono">
          {/* Leading Padding Cells */}
          {Array.from({ length: leadingPadding }).map((_, idx) => (
            <div
              key={`pad-${idx}`}
              className="min-h-[75px] sm:min-h-[90px] rounded-2xl border border-transparent opacity-20"
            />
          ))}

          {/* Month Days */}
          {monthDays.map((d) => {
            const dateStr = format(d, "yyyy-MM-dd");
            const dayNum = d.getDate();
            const dayData = tradesByDayMap.get(dateStr);
            const hasTrades = dayData && dayData.totalTrades > 0;
            const isWin = hasTrades && dayData.netPnl >= 0;

            return (
              <div
                key={dateStr}
                onClick={() => {
                  if (hasTrades) {
                    setSelectedDayDetail(dayData);
                  }
                }}
                className={`min-h-[75px] sm:min-h-[95px] p-2 sm:p-3 rounded-2xl border transition-all duration-150 flex flex-col justify-between select-none ${
                  hasTrades ? "cursor-pointer hover:scale-[1.02] shadow-sm" : "opacity-60"
                } ${
                  hasTrades
                    ? isWin
                      ? isLight
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                      : isLight
                      ? "bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                    : isLight
                    ? "bg-slate-50 border-slate-200 text-slate-500"
                    : "bg-white/[0.02] border-white/[0.06] text-gray-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs sm:text-sm font-sans">{dayNum.toString().padStart(2, "0")}</span>
                  {hasTrades && (
                    <span className="text-[10px] font-bold opacity-80">
                      {dayData.totalTrades} trades
                    </span>
                  )}
                </div>

                {hasTrades ? (
                  <div className="space-y-0.5">
                    <div className="text-xs sm:text-sm font-extrabold tracking-tight font-mono">
                      {isWin ? "+" : ""}${dayData.netPnl.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 dark:text-gray-600 block">No trades</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
          <div onClick={() => setSelectedDayDetail(null)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className={`relative z-10 w-full max-w-sm p-6 sm:p-7 rounded-3xl border shadow-2xl space-y-5 font-mono ${
              isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
            }`}
          >
            <button
              onClick={() => setSelectedDayDetail(null)}
              className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-mono">Trading Day Summary</span>
              <h3 className="text-lg font-bold font-sans">
                {format(parseISO(selectedDayDetail.dateStr), "EEEE, dd MMMM yyyy")}
              </h3>
            </div>

            <div
              className={`p-4 rounded-2xl border font-mono ${
                selectedDayDetail.netPnl >= 0
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-500"
              }`}
            >
              <span className="text-xs text-slate-500 dark:text-gray-400 block font-sans">Net P/L</span>
              <span className="text-2xl font-extrabold">
                {selectedDayDetail.netPnl >= 0 ? "+" : ""}${selectedDayDetail.netPnl.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                <span>Total Trades Executed:</span>
                <strong className="font-bold">{selectedDayDetail.totalTrades}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                <span>Winning Positions:</span>
                <strong className="font-bold text-emerald-500">{selectedDayDetail.winCount}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                <span>Losing Positions:</span>
                <strong className="font-bold text-rose-500">{selectedDayDetail.lossCount}</strong>
              </div>
            </div>

            {/* List of Closed Trades for selected date */}
            {("dayTrades" in selectedDayDetail) && (selectedDayDetail as any).dayTrades.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
                <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold block">Closed Deals</span>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {((selectedDayDetail as any).dayTrades as typeof trades).map((tr) => {
                    const netVal = tr.profit + (tr.commission || 0) + (tr.swap || 0);
                    return (
                      <div key={tr.ticket} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{tr.symbol}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${tr.side === "BUY" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                            {tr.side}
                          </span>
                          <span className="text-slate-400 text-[10px]">{tr.volume} lots</span>
                        </div>
                        <span className={`font-bold ${netVal >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {netVal >= 0 ? "+" : ""}${netVal.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
