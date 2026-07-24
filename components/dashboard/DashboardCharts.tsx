"use client";

import React, { useState } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useJournalMetrics } from "@/hooks/useJournalMetrics";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import {
  getEngineEquityCurve,
  getEngineDailyPnLSeries,
  getEngineWeeklyPnLSeries,
  getEngineMonthlyPnLSeries,
  getEngineDrawdownSeries,
  getEngineProfitDistribution,
  getEngineSymbolPerformance,
  getEngineHourlyPerformance,
  getEngineWeekdayPerformance,
} from "@/lib/engine/statistics-engine";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, BarChart3, PieChart as PieIcon, Info } from "lucide-react";

type Tab = "equity" | "daily" | "weekly" | "monthly" | "drawdown" | "distribution" | "symbols" | "hourly" | "weekday";

const TABS: { key: Tab; label: string }[] = [
  { key: "equity",       label: "Equity" },
  { key: "daily",        label: "Daily" },
  { key: "weekly",       label: "Weekly" },
  { key: "monthly",      label: "Monthly" },
  { key: "drawdown",     label: "Drawdown" },
  { key: "distribution", label: "Distribution" },
  { key: "symbols",      label: "Symbols" },
  { key: "hourly",       label: "Hourly" },
  { key: "weekday",      label: "Weekday" },
];

export const DashboardCharts: React.FC = () => {
  const theme = useJournalStore(s => s.theme);
  const { filteredTrades, stats } = useJournalMetrics();
  const { format: formatCurrency, currency } = useCurrencyFormatter();

  const [activeTab, setActiveTab] = useState<Tab>("equity");

  const isLight = theme === "light";

  // Dynamic Theme Colors for Charts
  const gridStroke = isLight ? "#E5E7EB" : "#1F293D";
  const axisStroke = isLight ? "#6B7280" : "#6B7280";
  const profitColor = isLight ? "#16A34A" : "#10B981";
  const lossColor   = isLight ? "#DC2626" : "#EF4444";
  const purpleColor = "#7C3AED";

  const tooltipStyle: React.CSSProperties = isLight
    ? {
        backgroundColor: "#FFFFFF",
        borderColor: "#E5E7EB",
        borderRadius: "12px",
        color: "#111827",
        fontSize: "12px",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      }
    : {
        backgroundColor: "#0F1420",
        borderColor: "#1F293D",
        borderRadius: "12px",
        color: "#FFFFFF",
        fontSize: "12px",
      };

  // Memoized data for all chart types
  const equityResult     = React.useMemo(() => getEngineEquityCurve(filteredTrades),           [filteredTrades]);
  const equityData       = equityResult.points;
  const dailyPnLData     = React.useMemo(() => getEngineDailyPnLSeries(filteredTrades),        [filteredTrades]);
  const weeklyPnLData    = React.useMemo(() => getEngineWeeklyPnLSeries(filteredTrades),       [filteredTrades]);
  const monthlyPnLData   = React.useMemo(() => getEngineMonthlyPnLSeries(filteredTrades),      [filteredTrades]);
  const drawdownData     = React.useMemo(() => getEngineDrawdownSeries(filteredTrades),         [filteredTrades]);
  const profitDistData   = React.useMemo(() => getEngineProfitDistribution(filteredTrades),    [filteredTrades]);
  const symbolData       = React.useMemo(() => getEngineSymbolPerformance(filteredTrades).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)).slice(0, 10), [filteredTrades]);
  const hourlyData       = React.useMemo(() => getEngineHourlyPerformance(filteredTrades),     [filteredTrades]);
  const weekdayData      = React.useMemo(() => getEngineWeekdayPerformance(filteredTrades),    [filteredTrades]);

  const winLossPieData = React.useMemo(() => [
    { name: "Wins",      value: stats.winningTrades,  color: profitColor },
    { name: "Losses",    value: stats.losingTrades,   color: lossColor },
    { name: "Breakeven", value: stats.breakevenCount, color: "#9CA3AF" },
  ].filter(d => d.value > 0), [stats, profitColor, lossColor]);

  if (filteredTrades.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Primary Chart with Tabs */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-400" />
              Performance Analytics
              {equityResult.isReconstructed && activeTab === "equity" && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Reconstructed
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-400">
              {filteredTrades.length} trades · {currency}
            </p>
          </div>

          {/* Tab switcher — horizontally scrollable on mobile */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-dark-card border border-dark-border text-xs font-mono overflow-x-auto max-w-full flex-nowrap shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-brand-600 text-white font-bold shadow-glow"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart body */}
        <div className="h-72 md:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === "equity" ? (
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={purpleColor} stopOpacity={isLight ? 0.25 : 0.4} />
                    <stop offset="95%" stopColor={purpleColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="date" stroke={axisStroke} fontSize={10} tickLine={false} interval="preserveStartEnd" />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatCurrency(Number(v)), equityResult.isReconstructed ? "Cumulative PnL" : "Account Balance"]} />
                <Area type="monotone" dataKey="equity" stroke={purpleColor} strokeWidth={2.5} fill="url(#equityGrad)" />
              </AreaChart>
            ) : activeTab === "daily" ? (
              <BarChart data={dailyPnLData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="date" stroke={axisStroke} fontSize={10} tickLine={false} interval="preserveStartEnd" />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatCurrency(Number(v)), "Daily PnL"]} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {dailyPnLData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? profitColor : lossColor} />)}
                </Bar>
              </BarChart>
            ) : activeTab === "weekly" ? (
              <BarChart data={weeklyPnLData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="week" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatCurrency(Number(v)), "Weekly PnL"]} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {weeklyPnLData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? profitColor : lossColor} />)}
                </Bar>
              </BarChart>
            ) : activeTab === "monthly" ? (
              <BarChart data={monthlyPnLData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="month" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatCurrency(Number(v)), "Monthly PnL"]} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {monthlyPnLData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? profitColor : lossColor} />)}
                </Bar>
              </BarChart>
            ) : activeTab === "drawdown" ? (
              <AreaChart data={drawdownData}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={lossColor} stopOpacity={isLight ? 0.25 : 0.4} />
                    <stop offset="95%" stopColor={lossColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="date" stroke={axisStroke} fontSize={10} tickLine={false} interval="preserveStartEnd" />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatCurrency(Number(v)), "Drawdown"]} />
                <Area type="monotone" dataKey="drawdown" stroke={lossColor} strokeWidth={2} fill="url(#ddGrad)" />
              </AreaChart>
            ) : activeTab === "distribution" ? (
              <BarChart data={profitDistData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="range" stroke={axisStroke} fontSize={9} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={purpleColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : activeTab === "symbols" ? (
              <BarChart data={symbolData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} horizontal={false} />
                <XAxis type="number" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis dataKey="symbol" type="category" stroke={axisStroke} fontSize={10} tickLine={false} width={55} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatCurrency(Number(v)), "PnL"]} />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                  {symbolData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? profitColor : lossColor} />)}
                </Bar>
              </BarChart>
            ) : activeTab === "hourly" ? (
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="hour" stroke={axisStroke} fontSize={9} tickLine={false} interval={1} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown, name: unknown) => [name === "pnl" ? formatCurrency(Number(v)) : `${v}`, name === "pnl" ? "PnL" : "Trades"]} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {hourlyData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? profitColor : lossColor} />)}
                </Bar>
              </BarChart>
            ) : (
              /* Weekday */
              <BarChart data={weekdayData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="day" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatCurrency(Number(v)), "PnL"]} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {weekdayData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? profitColor : lossColor} />)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Equity curve note */}
        {activeTab === "equity" && equityResult.isReconstructed && (
          <p className="text-[10px] text-amber-500 font-mono mt-3 flex items-center gap-1">
            <Info className="w-3 h-3" />
            No running balance found in CSV — chart shows cumulative PnL starting from $0
          </p>
        )}
      </div>

      {/* Secondary Grid: Win/Loss Pie + PnL Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Win/Loss Pie */}
        <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-500" />
              Win vs Loss Distribution
            </h4>
            <span className="text-xs font-mono text-gray-400">Win Rate: {stats.winRate}%</span>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={winLossPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {winLossPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs font-mono">
            {winLossPieData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-gray-300">{d.name} ({d.value})</span>
              </div>
            ))}
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

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitDistData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="range" stroke={axisStroke} fontSize={9} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={purpleColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
