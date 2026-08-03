"use client";
// app/(app)/reviews/page.tsx
// TradeFourge v4.2 Weekly & Monthly Performance Review Workspaces

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades } from "@/lib/supabase/trades";
import {
  generateWeeklyReview,
  generateMonthlyReview,
  fetchWeeklyReviews,
  fetchMonthlyReviews,
} from "@/lib/toolkit/reviews-service";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import type { CloudTradeWithRelations, WeeklyReview, MonthlyReview } from "@/types/database";
import {
  CalendarDays,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Award,
  RefreshCw,
  Plus,
} from "lucide-react";

export default function ReviewsPage() {
  const { formatSigned } = useCurrencyFormatter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [trades, setTrades] = useState<CloudTradeWithRelations[]>([]);
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");

  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [monthlyReviews, setMonthlyReviews] = useState<MonthlyReview[]>([]);

  const loadData = async (uid: string) => {
    const { data } = await fetchTrades(uid, {}, 1, 10000, "close_time", false);
    const loadedTrades = data?.data ?? [];
    setTrades(loadedTrades);

    setWeeklyReviews(fetchWeeklyReviews(uid));
    setMonthlyReviews(fetchMonthlyReviews(uid));
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        loadData(user.id);
      }
    })();
  }, []);

  const handleGenerateWeekly = () => {
    if (!userId) return;
    generateWeeklyReview(userId, trades);
    setWeeklyReviews(fetchWeeklyReviews(userId));
  };

  const handleGenerateMonthly = () => {
    if (!userId) return;
    generateMonthlyReview(userId, trades);
    setMonthlyReviews(fetchMonthlyReviews(userId));
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-purple-400" />
            <span>Weekly & Monthly Reviews Workspace</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Automated performance review workspaces to reflect on execution, mistakes, and improvements
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "weekly" ? (
            <button
              onClick={handleGenerateWeekly}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow flex items-center gap-2 shrink-0 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Weekly Review</span>
            </button>
          ) : (
            <button
              onClick={handleGenerateMonthly}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow flex items-center gap-2 shrink-0 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Monthly Review</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-dark-border pb-3">
        <button
          onClick={() => setActiveTab("weekly")}
          className={`px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 ${
            activeTab === "weekly"
              ? "bg-purple-600/20 border border-purple-500/30 text-purple-300"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Weekly Reviews ({weeklyReviews.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("monthly")}
          className={`px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 ${
            activeTab === "monthly"
              ? "bg-purple-600/20 border border-purple-500/30 text-purple-300"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Monthly Reviews ({monthlyReviews.length})</span>
        </button>
      </div>

      {/* WEEKLY REVIEWS LIST */}
      {activeTab === "weekly" && (
        <div className="space-y-4">
          {weeklyReviews.length === 0 ? (
            <div className="p-8 rounded-2xl glass-card border border-dark-border text-center space-y-3">
              <CalendarDays className="w-8 h-8 text-gray-500 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Weekly Reviews Generated Yet</h3>
              <p className="text-xs text-gray-400">
                Click "Generate Weekly Review" above to create your first weekly performance review workspace.
              </p>
            </div>
          ) : (
            weeklyReviews.map((r) => (
              <div
                key={r.id}
                className="p-5 rounded-2xl glass-card border border-dark-border space-y-4 hover:border-purple-500/30 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">{r.week_label}</h3>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      {r.total_trades} Trades Executed · Win Rate: {r.win_rate}%
                    </span>
                  </div>

                  <span className={`text-base font-extrabold font-mono ${r.weekly_pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatSigned(r.weekly_pnl)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
                  <div className="p-3 rounded-xl bg-dark-card border border-white/5 space-y-1.5">
                    <span className="text-[10px] text-amber-400 font-bold block">BEHAVIORAL MISTAKES & VIOLATIONS</span>
                    <ul className="space-y-1 text-gray-300">
                      {r.mistakes_summary.map((m, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-dark-card border border-white/5 space-y-1.5">
                    <span className="text-[10px] text-emerald-400 font-bold block">PLANNED IMPROVEMENTS</span>
                    <ul className="space-y-1 text-gray-300">
                      {r.improvements.map((imp, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {r.notes && (
                  <p className="p-3 rounded-xl bg-black/30 border border-white/5 text-gray-300 leading-relaxed">
                    {r.notes}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* MONTHLY REVIEWS LIST */}
      {activeTab === "monthly" && (
        <div className="space-y-4">
          {monthlyReviews.length === 0 ? (
            <div className="p-8 rounded-2xl glass-card border border-dark-border text-center space-y-3">
              <Calendar className="w-8 h-8 text-gray-500 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Monthly Reviews Generated Yet</h3>
              <p className="text-xs text-gray-400">
                Click "Generate Monthly Review" above to create your first monthly performance reflection.
              </p>
            </div>
          ) : (
            monthlyReviews.map((r) => (
              <div
                key={r.id}
                className="p-5 rounded-2xl glass-card border border-dark-border space-y-4 hover:border-purple-500/30 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">{r.month_label}</h3>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      {r.total_trades} Trades Executed · Win Rate: {r.win_rate}%
                    </span>
                  </div>

                  <span className={`text-base font-extrabold font-mono ${r.monthly_pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatSigned(r.monthly_pnl)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
                  <div className="p-3 rounded-xl bg-dark-card border border-white/5 space-y-1">
                    <span className="text-[10px] text-purple-400 font-bold block">STRATEGY PERFORMANCE</span>
                    <p className="text-gray-300">Best Model: <strong className="text-white">{r.best_strategy}</strong></p>
                    <p className="text-gray-300">Weakest Model: <strong className="text-white">{r.weakest_strategy}</strong></p>
                  </div>

                  <div className="p-3 rounded-xl bg-dark-card border border-white/5 space-y-1">
                    <span className="text-[10px] text-emerald-400 font-bold block">GOALS ACHIEVED</span>
                    <ul className="space-y-1 text-gray-300">
                      {r.goals_summary.map((g, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {r.reflection && (
                  <p className="p-3 rounded-xl bg-black/30 border border-white/5 text-gray-300 leading-relaxed">
                    {r.reflection}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
