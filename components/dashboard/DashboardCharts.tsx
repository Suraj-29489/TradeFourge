"use client";

import React, { useState } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useJournalMetrics } from "@/hooks/useJournalMetrics";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import {
  getEngineEquityCurve,
  getEngineDailyPnLSeries,
  getEngineMonthlyPnLSeries,
  getEngineDrawdownSeries,
  getEngineProfitDistribution,
} from "@/lib/engine/statistics-engine";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, BarChart3, PieChart as PieIcon, Activity, Calendar } from "lucide-react";

export const DashboardCharts: React.FC = () => {
  const settings = useJournalStore((state) => state.settings);
  const { filteredTrades, stats } = useJournalMetrics();
  const { format: formatCurrency, currency } = useCurrencyFormatter();

  const [activeTab, setActiveTab] = useState<"equity" | "daily" | "monthly" | "drawdown">("equity");

  const equityData = React.useMemo(
    () => getEngineEquityCurve(filteredTrades, settings.initialBalance),
    [filteredTrades, settings.initialBalance]
  );

  const dailyPnLData = React.useMemo(
    () => getEngineDailyPnLSeries(filteredTrades),
    [filteredTrades]
  );

  const monthlyPnLData = React.useMemo(
    () => getEngineMonthlyPnLSeries(filteredTrades),
    [filteredTrades]
  );

  const drawdownData = React.useMemo(
    () => getEngineDrawdownSeries(filteredTrades, settings.initialBalance),
    [filteredTrades, settings.initialBalance]
  );

  const profitDistData = React.useMemo(
    () => getEngineProfitDistribution(filteredTrades),
    [filteredTrades]
  );

  const winLossPieData = React.useMemo(() => {
    return [
      { name: "Winning Trades", value: stats.winningTrades, color: "#10B981" },
      { name: "Losing Trades", value: stats.losingTrades, color: "#EF4444" },
      { name: "Breakeven", value: stats.breakevenCount, color: "#6B7280" },
    ].filter((d) => d.value > 0);
  }, [stats]);

  if (filteredTrades.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Primary Interactive Equity & PnL Chart */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border">
        {/* Chart Header & Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-400" />
              Account Performance & Growth Series
            </h3>
            <p className="text-xs text-gray-400">
              Interactive visualizations calculated purely from normalized position executions ({currency})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-dark-bg border border-dark-border text-xs font-mono">
            <button
              onClick={() => setActiveTab("equity")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "equity"
                  ? "bg-brand-600 text-white font-bold shadow-glow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Equity Curve
            </button>
            <button
              onClick={() => setActiveTab("daily")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "daily"
                  ? "bg-brand-600 text-white font-bold shadow-glow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Daily PnL
            </button>
            <button
              onClick={() => setActiveTab("monthly")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "monthly"
                  ? "bg-brand-600 text-white font-bold shadow-glow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setActiveTab("drawdown")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "drawdown"
                  ? "bg-brand-600 text-white font-bold shadow-glow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Drawdown
            </button>
          </div>
        </div>

        {/* Dynamic Chart Body */}
        <div className="h-72 md:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === "equity" ? (
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" opacity={0.5} />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={10} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={10} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F1420",
                    borderColor: "#1F293D",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "Equity Balance"]}
                />
                <Area type="monotone" dataKey="equity" stroke="#7C3AED" strokeWidth={2.5} fill="url(#equityGrad)" />
              </AreaChart>
            ) : activeTab === "daily" ? (
              <BarChart data={dailyPnLData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" opacity={0.5} />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={10} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F1420",
                    borderColor: "#1F293D",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "Daily PnL"]}
                />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                  {dailyPnLData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? "#10B981" : "#EF4444"} />
                  ))}
                </Bar>
              </BarChart>
            ) : activeTab === "monthly" ? (
              <BarChart data={monthlyPnLData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" opacity={0.5} />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={10} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F1420",
                    borderColor: "#1F293D",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "Monthly PnL"]}
                />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                  {monthlyPnLData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? "#10B981" : "#EF4444"} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <AreaChart data={drawdownData}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" opacity={0.5} />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={10} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F1420",
                    borderColor: "#1F293D",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "Drawdown"]}
                />
                <Area type="monotone" dataKey="drawdown" stroke="#EF4444" strokeWidth={2} fill="url(#ddGrad)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary Grid (Win/Loss Ratio & Profit Distribution) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Win/Loss Pie */}
        <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-400" />
              Win vs Loss Distribution
            </h4>
            <span className="text-xs font-mono text-gray-400">Win Rate: {stats.winRate}%</span>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={winLossPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {winLossPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F1420",
                    borderColor: "#1F293D",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-gray-300">Wins ({stats.winningTrades})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
              <span className="text-gray-300">Losses ({stats.losingTrades})</span>
            </div>
            {stats.breakevenCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                <span className="text-gray-300">Breakeven ({stats.breakevenCount})</span>
              </div>
            )}
          </div>
        </div>

        {/* Profit Distribution Histogram */}
        <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-400" />
              PnL Bucket Distribution
            </h4>
            <span className="text-xs font-mono text-gray-400">{filteredTrades.length} trades</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitDistData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" opacity={0.5} />
                <XAxis dataKey="range" stroke="#6B7280" fontSize={9} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F1420",
                    borderColor: "#1F293D",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill="#7C3AED" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
