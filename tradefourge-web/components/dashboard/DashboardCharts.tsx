"use client";
// components/dashboard/DashboardCharts.tsx
// Dynamic performance analytics charts rendering live CloudTrade data from Supabase.

import React, { useState, useEffect, useMemo } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades } from "@/lib/supabase/trades";
import { calculateCloudAnalytics } from "@/lib/engine/cloud-analytics-engine";
import type { CloudTradeWithRelations } from "@/types/database";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, BarChart3, PieChart as PieIcon, Info } from "lucide-react";

type Tab = "equity" | "daily" | "weekly" | "monthly" | "symbols" | "hourly" | "weekday";

const TABS: { key: Tab; label: string }[] = [
  { key: "equity",  label: "Equity" },
  { key: "daily",   label: "Daily" },
  { key: "weekly",  label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "symbols", label: "Symbols" },
  { key: "hourly",  label: "Hourly" },
  { key: "weekday", label: "Weekday" },
];

interface DashboardChartsProps {
  trades?: CloudTradeWithRelations[];
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ trades: initialTrades }) => {
  const theme = useJournalStore(s => s.theme);
  const { format: formatCurrency, formatSigned, currency } = useCurrencyFormatter();
  const supabase = createClient();

  const [trades, setTrades] = useState<CloudTradeWithRelations[]>(initialTrades || []);
  const [loading, setLoading] = useState(!initialTrades);
  const [activeTab, setActiveTab] = useState<Tab>("equity");

  useEffect(() => {
    if (initialTrades) {
      setTrades(initialTrades);
      setLoading(false);
      return;
    }

    async function loadCloudTrades() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await fetchTrades(user.id, {}, 1, 10000, "close_time", false);
        if (data?.data) setTrades(data.data);
      }
      setLoading(false);
    }
    loadCloudTrades();
  }, [initialTrades]);

  const analytics = useMemo(() => {
    return calculateCloudAnalytics(trades);
  }, [trades]);

  const isLight = theme === "light";
  const gridStroke = isLight ? "#E5E7EB" : "#1F293D";
  const axisStroke = isLight ? "#6B7280" : "#6B7280";
  const profitColor = isLight ? "#16A34A" : "#10B981";
  const lossColor   = isLight ? "#DC2626" : "#EF4444";
  const blueColor = "#2563EB";

  const tooltipStyle: React.CSSProperties = isLight
    ? {
        backgroundColor: "#FFFFFF",
        borderColor: "#CBD5E1",
        borderRadius: "12px",
        color: "#0F172A",
        fontSize: "12px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
      }
    : {
        backgroundColor: "#0B0F19",
        borderColor: "#1E293B",
        borderRadius: "12px",
        color: "#FFFFFF",
        fontSize: "12px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
      };

  const winLossPieData = useMemo(() => [
    { name: "Wins",      value: analytics.wins,  color: profitColor },
    { name: "Losses",    value: analytics.losses, color: lossColor },
    { name: "Breakeven", value: analytics.breakevens, color: "#9CA3AF" },
  ].filter(d => d.value > 0), [analytics, profitColor, lossColor]);

  if (loading) {
    return <div className="h-96 rounded-2xl glass-card border border-dark-border animate-pulse" />;
  }

  if (trades.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 text-xs font-mono">
      {/* Primary Chart with Tabs */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Performance Analytics
            </h3>
            <p className="text-xs text-gray-400">
              {trades.length} cloud trades · {currency}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-dark-card border border-dark-border text-xs overflow-x-auto max-w-full flex-nowrap shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-purple-600 text-white font-bold shadow-glow"
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
              <AreaChart data={analytics.equityCurve}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={blueColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={blueColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                <XAxis dataKey="date" stroke={axisStroke} fontSize={11} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatCurrency(v), "Cumulative PnL"]} />
                <Area type="monotone" dataKey="cumulativeProfit" stroke={blueColor} strokeWidth={2.5} fill="url(#equityGrad)" />
              </AreaChart>
            ) : activeTab === "daily" ? (
              <BarChart data={analytics.daysOfWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="period" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatSigned(Number(v)), "Net PnL"]} />
                <Bar dataKey="netProfit" radius={[4, 4, 0, 0]}>
                  {analytics.daysOfWeek.map((entry, i) => <Cell key={i} fill={entry.netProfit >= 0 ? profitColor : lossColor} />)}
                </Bar>
              </BarChart>
            ) : activeTab === "weekly" ? (
              <BarChart data={analytics.daysOfWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="period" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatSigned(Number(v)), "Net PnL"]} />
                <Bar dataKey="netProfit" radius={[4, 4, 0, 0]}>
                  {analytics.daysOfWeek.map((entry, i) => <Cell key={i} fill={entry.netProfit >= 0 ? profitColor : lossColor} />)}
                </Bar>
              </BarChart>
            ) : activeTab === "monthly" ? (
              <BarChart data={analytics.daysOfWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="period" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatSigned(Number(v)), "Net PnL"]} />
                <Bar dataKey="netProfit" radius={[4, 4, 0, 0]}>
                  {analytics.daysOfWeek.map((entry, i) => <Cell key={i} fill={entry.netProfit >= 0 ? profitColor : lossColor} />)}
                </Bar>
              </BarChart>
            ) : activeTab === "symbols" ? (
              <BarChart data={analytics.symbols.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} horizontal={false} />
                <XAxis type="number" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis dataKey="symbol" type="category" stroke={axisStroke} fontSize={10} tickLine={false} width={55} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatSigned(Number(v)), "Net PnL"]} />
                <Bar dataKey="netProfit" radius={[0, 4, 4, 0]}>
                  {analytics.symbols.slice(0, 10).map((entry, i) => <Cell key={i} fill={entry.netProfit >= 0 ? profitColor : lossColor} />)}
                </Bar>
              </BarChart>
            ) : activeTab === "hourly" ? (
              <BarChart data={analytics.hoursOfDay}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="period" stroke={axisStroke} fontSize={9} tickLine={false} interval={1} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatSigned(Number(v)), "Net PnL"]} />
                <Bar dataKey="netProfit" radius={[4, 4, 0, 0]}>
                  {analytics.hoursOfDay.map((entry, i) => <Cell key={i} fill={entry.netProfit >= 0 ? profitColor : lossColor} />)}
                </Bar>
              </BarChart>
            ) : (
              /* Weekday */
              <BarChart data={analytics.daysOfWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.7} />
                <XAxis dataKey="period" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatSigned(Number(v)), "Net PnL"]} />
                <Bar dataKey="netProfit" radius={[4, 4, 0, 0]}>
                  {analytics.daysOfWeek.map((entry, i) => <Cell key={i} fill={entry.netProfit >= 0 ? profitColor : lossColor} />)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary Grid: Win/Loss Pie + Session Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Win/Loss Pie */}
        <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-400" />
              Win vs Loss Distribution
            </h4>
            <span className="text-xs font-mono text-gray-400">Win Rate: {analytics.winRate}%</span>
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

        {/* Trading Session Performance */}
        <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              Session Performance Breakdown
            </h4>
            <span className="text-xs text-gray-400">{analytics.sessions.length} sessions</span>
          </div>

          <div className="space-y-2">
            {analytics.sessions.map((sess) => (
              <div key={sess.session} className="p-2.5 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between">
                <span className="text-white font-bold">{sess.session}</span>
                <div className="flex items-center gap-4">
                  <span className="text-gray-400">{sess.trades} trades ({sess.winRate}% WR)</span>
                  <span className={`font-bold ${sess.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatSigned(sess.netProfit)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
