"use client";
// components/calendar/TradeCalendar.tsx
// Cloud-backed daily trading heatmap calendar connected directly to Supabase `trades` table.

import React, { useState, useEffect, useMemo } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades } from "@/lib/supabase/trades";
import type { CloudTradeWithRelations } from "@/types/database";
import { CloudTradeDetailDrawer } from "@/components/trades/CloudTradeDetailDrawer";
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const TradeCalendar: React.FC = () => {
  const theme = useJournalStore((s) => s.theme);
  const { format: formatCurrency, formatSigned } = useCurrencyFormatter();
  const supabase = createClient();

  const [trades, setTrades] = useState<CloudTradeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDayTrades, setSelectedDayTrades] = useState<{ date: Date; trades: CloudTradeWithRelations[] } | null>(null);
  const [activeDrawerTrade, setActiveDrawerTrade] = useState<CloudTradeWithRelations | null>(null);

  const isLight = theme === "light";

  const loadTrades = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await fetchTrades(user.id, {}, 1, 10000, "close_time", false);
      if (data?.data) {
        setTrades(data.data);
        if (data.data.length > 0 && data.data[0].close_time) {
          const latestDate = parseISO(data.data[0].close_time);
          if (!isNaN(latestDate.getTime())) {
            setCurrentMonth(latestDate);
          }
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTrades();
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const tradesByDay = useMemo(() => {
    const map = new Map<string, { trades: CloudTradeWithRelations[]; pnl: number }>();
    trades.forEach((t) => {
      const closeStr = t.close_time || t.created_at;
      if (!closeStr) return;
      const dateKey = format(parseISO(closeStr), "yyyy-MM-dd");
      const existing = map.get(dateKey) || { trades: [], pnl: 0 };
      existing.trades.push(t);
      existing.pnl += t.net_profit;
      map.set(dateKey, existing);
    });
    return map;
  }, [trades]);

  const monthStats = useMemo(() => {
    let monthlyPnL = 0;
    let greenDays = 0;
    let redDays = 0;

    daysInMonth.forEach((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const dayData = tradesByDay.get(dateKey);
      if (dayData && dayData.trades.length > 0) {
        monthlyPnL += dayData.pnl;
        if (dayData.pnl > 0) greenDays++;
        else if (dayData.pnl < 0) redDays++;
      }
    });

    return { monthlyPnL, greenDays, redDays };
  }, [daysInMonth, tradesByDay]);

  return (
    <div className="space-y-6 text-xs font-mono">
      {/* Calendar Header Controls */}
      <div className="p-5 rounded-2xl glass-card border border-dark-border flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              {format(currentMonth, "MMMM yyyy")}
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-dark-card text-purple-400 border border-purple-500/30">
                CLOUD HEATMAP
              </span>
            </h2>
            <p className="text-xs text-gray-400 font-mono">Monthly closed PnL calendar & cloud position totals</p>
          </div>
        </div>

        {/* Navigation & Summary Stats */}
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
            <div className="text-right">
              <span className="text-gray-400 block text-[10px]">MONTHLY P&L</span>
              <span className={`font-bold text-sm ${monthStats.monthlyPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatSigned(monthStats.monthlyPnL)}
              </span>
            </div>
            <div className="text-right border-l border-dark-border pl-4">
              <span className="text-gray-400 block text-[10px]">WIN/LOSS DAYS</span>
              <span className="text-white font-bold">
                <span className="text-emerald-400">{monthStats.greenDays}W</span> /{" "}
                <span className="text-rose-400">{monthStats.redDays}L</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-hover text-gray-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-hover text-xs font-mono text-gray-300 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-hover text-gray-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={loadTrades}
              className="p-2 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-hover text-gray-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Calendar Grid */}
      <div className="p-4 md:p-6 rounded-2xl glass-card border border-dark-border">
        <div className="grid grid-cols-7 gap-2 mb-3 text-center text-xs font-mono font-semibold text-gray-400 uppercase">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {Array.from({ length: startDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-16 sm:h-24 md:h-28 rounded-xl bg-dark-card/20 border border-transparent" />
          ))}

          {daysInMonth.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayData = tradesByDay.get(dateKey);
            const hasTrades = dayData && dayData.trades.length > 0;
            const pnl = dayData ? dayData.pnl : 0;
            const isProfit = pnl > 0;
            const isLoss = pnl < 0;

            let cellStyle = "bg-dark-card border-dark-border text-gray-500 hover:border-gray-300";
            if (hasTrades) {
              if (isProfit) {
                cellStyle = "bg-emerald-500/10 border-emerald-500/40 hover:bg-emerald-500/20";
              } else if (isLoss) {
                cellStyle = "bg-rose-500/10 border-rose-500/40 hover:bg-rose-500/20";
              } else {
                cellStyle = "bg-gray-800/40 border-gray-700 hover:bg-gray-800/70";
              }
            }

            return (
              <motion.div
                key={dateKey}
                whileHover={{ scale: 1.02 }}
                onClick={() => {
                  if (hasTrades) {
                    setSelectedDayTrades({ date: day, trades: dayData.trades });
                  }
                }}
                className={`h-16 sm:h-24 md:h-28 rounded-xl p-1.5 sm:p-2 md:p-3 flex flex-col justify-between transition-all duration-200 border cursor-pointer relative overflow-hidden group ${cellStyle}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono font-bold ${hasTrades ? "text-white" : "text-gray-400"}`}>
                    {format(day, "d")}
                  </span>
                  {hasTrades && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-gray-300">
                      {dayData.trades.length} {dayData.trades.length === 1 ? "trade" : "trades"}
                    </span>
                  )}
                </div>

                {hasTrades ? (
                  <div className="mt-auto">
                    <span
                      className={`text-xs md:text-sm font-bold font-mono tracking-tight block ${
                        isProfit ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-gray-400"
                      }`}
                    >
                      {formatSigned(pnl)}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-gray-500 mt-auto">No Trades</span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Day Trades Modal */}
      <AnimatePresence>
        {selectedDayTrades && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDayTrades(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-2xl bg-dark-card border border-dark-border rounded-2xl p-6 shadow-2xl max-h-[85vh] flex flex-col space-y-4"
            >
              <div className="flex items-center justify-between border-b border-dark-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Positions Closed on {format(selectedDayTrades.date, "EEEE, MMMM d, yyyy")}
                  </h3>
                  <span className="text-xs font-mono text-gray-400">
                    {selectedDayTrades.trades.length} positions recorded in cloud
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDayTrades(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-dark-hover transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {selectedDayTrades.trades.map((t) => {
                  const isWin = t.outcome === "WIN";
                  const isLoss = t.outcome === "LOSS";
                  const isBuy = t.side === "BUY" || t.side === "LONG";

                  return (
                    <div
                      key={t.id}
                      onClick={() => setActiveDrawerTrade(t)}
                      className="p-4 rounded-xl bg-dark-bg border border-dark-border hover:border-purple-500/40 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg border ${
                            isBuy
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {isBuy ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white font-mono">{t.symbol}</span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                              {t.volume} Lot
                            </span>
                          </div>
                          <span className="text-xs font-mono text-gray-400">
                            {t.close_time ? format(parseISO(t.close_time), "HH:mm:ss") : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-sm font-bold font-mono block ${
                            isWin ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-gray-400"
                          }`}
                        >
                          {formatSigned(t.net_profit)}
                        </span>
                        <span className="text-[10px] font-mono text-purple-400">
                          {t.rr_ratio !== null ? `${t.rr_ratio} R` : "R:R N/A"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CloudTradeDetailDrawer
        trade={activeDrawerTrade}
        onClose={() => setActiveDrawerTrade(null)}
        onRefresh={loadTrades}
      />
    </div>
  );
};
