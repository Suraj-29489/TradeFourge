"use client";
// app/(app)/goals/page.tsx
// TradeFourge v4.2 Goals & Discipline Tracking Workspace

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades } from "@/lib/supabase/trades";
import { fetchGoals, saveGoal, deleteGoal, recalculateGoalsProgress } from "@/lib/toolkit/goals-service";
import type { TraderGoal, CloudTradeWithRelations, GoalCategory } from "@/types/database";
import {
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  TrendingUp,
  Award,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function GoalsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [trades, setTrades] = useState<CloudTradeWithRelations[]>([]);
  const [goals, setGoals] = useState<TraderGoal[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GoalCategory>("win_rate");
  const [targetValue, setTargetValue] = useState<number>(60);
  const [unit, setUnit] = useState("%");

  const loadData = async (uid: string) => {
    const { data } = await fetchTrades(uid, {}, 1, 10000, "close_time", false);
    const loadedTrades = data?.data ?? [];
    setTrades(loadedTrades);

    const loadedGoals = fetchGoals(uid);
    const updatedGoals = recalculateGoalsProgress(loadedGoals, loadedTrades);
    setGoals(updatedGoals);
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

  const handleSave = () => {
    if (!userId || !title) return;

    saveGoal(userId, {
      title,
      category,
      target_value: targetValue,
      current_value: 0,
      unit,
      status: "active",
    });

    setIsFormOpen(false);
    loadData(userId);
  };

  const handleDelete = (id: string) => {
    if (!userId) return;
    if (confirm("Delete this goal?")) {
      deleteGoal(userId, id);
      loadData(userId);
    }
  };

  const handleCategoryChange = (cat: GoalCategory) => {
    setCategory(cat);
    if (cat === "win_rate") {
      setTargetValue(60);
      setUnit("%");
    } else if (cat === "profit_target") {
      setTargetValue(5000);
      setUnit("$");
    } else if (cat === "target_rr") {
      setTargetValue(2.0);
      setUnit("R");
    } else if (cat === "trade_count") {
      setTargetValue(50);
      setUnit("trades");
    }
  };

  const inputClass =
    "w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 font-mono";
  const labelClass = "block text-xs font-mono text-gray-400 mb-1";

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-400" />
            <span>Discipline & Goal Tracking</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Set quantitative performance targets and track live progress dynamically
          </p>
        </div>

        <button
          onClick={() => setIsFormOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-glow flex items-center gap-2 shrink-0 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Goal Target</span>
        </button>
      </div>

      {/* Form Card if open */}
      {isFormOpen && (
        <div className="p-6 rounded-3xl glass-card border border-blue-500/30 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            <span>Set New Target Goal</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Goal Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Maintain 60%+ Win Rate"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Goal Category</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as GoalCategory)}
                className={inputClass}
              >
                <option value="win_rate">Win Rate Target (%)</option>
                <option value="profit_target">Monthly Profit Target ($)</option>
                <option value="target_rr">Average R:R Target (R)</option>
                <option value="trade_count">Total Executed Trades</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Target Value ({unit})</label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-50"
            >
              Save Goal Target
            </button>
          </div>
        </div>
      )}

      {/* Goals Progress Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((g) => {
          const isAchieved = g.status === "achieved";
          const pct = Math.min(Math.round((g.current_value / (g.target_value || 1)) * 100), 100);

          return (
            <div
              key={g.id}
              className="p-5 rounded-2xl glass-card border border-dark-border space-y-4 hover:border-blue-500/30 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{g.title}</span>
                  </h3>
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block mt-0.5">
                    Category: {g.category.replace("_", " ")}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isAchieved ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Achieved</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[10px] font-bold">
                      In Progress
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Values */}
              <div className="flex items-end justify-between text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px]">CURRENT VALUE</span>
                  <span className="text-lg font-extrabold text-white font-mono">
                    {g.unit === "$" ? `$${g.current_value.toLocaleString()}` : `${g.current_value} ${g.unit}`}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-gray-500 block text-[10px]">TARGET VALUE</span>
                  <span className="text-sm font-bold text-blue-300 font-mono">
                    {g.unit === "$" ? `$${g.target_value.toLocaleString()}` : `${g.target_value} ${g.unit}`}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isAchieved
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                        : "bg-gradient-to-r from-blue-600 to-indigo-500"
                    }`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Progress</span>
                  <span className="font-bold text-white">{pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
