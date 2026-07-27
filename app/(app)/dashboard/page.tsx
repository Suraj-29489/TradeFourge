"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { StatCard } from "@/components/dashboard/StatCard";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProfile, calculateProfileCompletion, type UserProfile } from "@/lib/supabase/profile";
import { fetchTradingAccounts } from "@/lib/supabase/accounts";
import { fetchTradeStats, type CloudTradeStats } from "@/lib/supabase/trades";
import { fetchLatestImport } from "@/lib/supabase/csv-imports";
import { StatGridSkeleton } from "@/components/ui/LoadingSkeleton";
import type { CsvImport, TradingAccount } from "@/types/database";
import { useUserProfile } from "@/context/UserProfileContext";
import {
  DollarSign,
  Percent,
  Zap,
  Target,
  Award,
  ShieldCheck,
  Activity,
  Layers,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Globe,
  Clock,
  User,
  Wallet,
  Upload,
  History,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";

// Lazy-load heavy charts — only renders after hydration
const DashboardCharts = dynamic(
  () => import("@/components/dashboard/DashboardCharts").then((m) => ({ default: m.DashboardCharts })),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl glass-card border border-dark-border animate-pulse" /> }
);

export default function DashboardPage() {
  const init = useJournalStore((state) => state.init);
  const { format: fmtCurrency, formatSigned } = useCurrencyFormatter();
  const supabase = createClient();

  const { profile: contextProfile, completionPct } = useUserProfile();
  const [profile, setProfile]             = useState<UserProfile | null>(null);
  const [accounts, setAccounts]           = useState<TradingAccount[]>([]);
  const [tradeStats, setTradeStats]       = useState<CloudTradeStats | null>(null);
  const [latestImport, setLatestImport]   = useState<CsvImport | null>(null);
  const [cloudLoading, setCloudLoading]   = useState(true);

  useEffect(() => {
    init(); // Initialize ephemeral UI state from localStorage
    async function loadCloudData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [prof, accs, stats, imp] = await Promise.all([
          fetchUserProfile(user.id),
          fetchTradingAccounts(user.id),
          fetchTradeStats(user.id),
          fetchLatestImport(user.id),
        ]);

        if (prof)       setProfile(prof);
        if (accs.data)  setAccounts(accs.data);
        if (stats.data) setTradeStats(stats.data);
        if (imp.data)   setLatestImport(imp.data);
      } catch (err) {
        console.error("Dashboard cloud load failed:", err);
      } finally {
        setCloudLoading(false);
      }
    }
    loadCloudData();
  }, [init]);

  const activeProfile = contextProfile || profile;
  const defaultAccount = accounts.find((a) => a.is_default);
  const hasCloudData = tradeStats && tradeStats.totalTrades > 0;

  return (
    <div className="space-y-6">
      {/* ── Welcome Banner ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#111726] to-[#182238] border border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="relative group shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 p-0.5 shadow-glow overflow-hidden flex items-center justify-center">
              {activeProfile?.avatar_url ? (
                <img src={activeProfile.avatar_url} alt={activeProfile.full_name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <div className="w-full h-full rounded-xl bg-[#111726] flex items-center justify-center text-lg font-bold font-mono text-purple-400">
                  {activeProfile?.full_name ? activeProfile.full_name.charAt(0).toUpperCase() : "T"}
                </div>
              )}
            </div>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight font-mono">
                Welcome back, {activeProfile?.full_name || "Trader"}
              </h1>
              <span className="text-xs font-mono text-purple-400 font-bold">
                @{activeProfile?.username || "trader"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-mono mt-1">
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-indigo-400" /> {activeProfile?.country || "—"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> {activeProfile?.timezone || "UTC"}
              </span>
              <span>•</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-600/20 text-purple-400 border border-purple-500/30 uppercase">
                Cloud Journal v3
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-gray-300 flex items-center gap-2 transition-all"
          >
            <User className="w-3.5 h-3.5 text-purple-400" />
            Profile {completionPct}%
          </Link>
          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400 flex items-center gap-2 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Cloud Active</span>
          </div>
        </div>
      </div>

      {/* ── Cloud Overview Strip ────────────────────────────────────────────── */}
      {cloudLoading ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Accounts */}
          <div className="p-5 rounded-2xl glass-card border border-dark-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/20 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-gray-400">Trading Accounts</p>
              <p className="text-2xl font-extrabold text-white font-mono">{accounts.length}</p>
              {defaultAccount && (
                <p className="text-[10px] text-gray-500 font-mono truncate max-w-[120px]">
                  Default: {defaultAccount.account_name}
                </p>
              )}
            </div>
          </div>

          {/* Total Trades */}
          <div className="p-5 rounded-2xl glass-card border border-dark-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-gray-400">Cloud Trades</p>
              <p className="text-2xl font-extrabold text-white font-mono">
                {tradeStats?.totalTrades.toLocaleString() ?? "0"}
              </p>
              {tradeStats && tradeStats.totalTrades > 0 && (
                <p className="text-[10px] text-emerald-400 font-mono">
                  {tradeStats.winRate.toFixed(1)}% win rate
                </p>
              )}
            </div>
          </div>

          {/* Cloud P&L */}
          <div className="p-5 rounded-2xl glass-card border border-dark-border flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                (tradeStats?.totalNetProfit ?? 0) >= 0
                  ? "bg-emerald-500/20 border border-emerald-500/20"
                  : "bg-rose-500/20 border border-rose-500/20"
              }`}
            >
              {(tradeStats?.totalNetProfit ?? 0) >= 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-rose-400" />
              )}
            </div>
            <div>
              <p className="text-xs font-mono text-gray-400">Net Profit</p>
              <p
                className={`text-2xl font-extrabold font-mono ${
                  (tradeStats?.totalNetProfit ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {tradeStats
                  ? `${tradeStats.totalNetProfit >= 0 ? "+" : ""}${fmtCurrency(tradeStats.totalNetProfit)}`
                  : "$0.00"}
              </p>
              <p className="text-[10px] text-gray-500 font-mono">All time</p>
            </div>
          </div>

          {/* Latest Import */}
          <div className="p-5 rounded-2xl glass-card border border-dark-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-600/20 border border-sky-500/20 flex items-center justify-center shrink-0">
              <History className="w-5 h-5 text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-mono text-gray-400">Latest Import</p>
              {latestImport ? (
                <>
                  <p className="text-sm font-bold text-white font-mono truncate">
                    {latestImport.broker ?? "Unknown broker"}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono">
                    {latestImport.imported_rows} trades
                  </p>
                </>
              ) : (
                <p className="text-sm font-mono text-gray-500">No imports yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Empty Cloud State ──────────────────────────────────────────────── */}
      {!cloudLoading && !hasCloudData && (
        <div className="p-8 rounded-3xl glass-card border border-dark-border text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <Upload className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Your Cloud Journal is Empty
            </h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto mt-2">
              Import your first CSV from your broker to see live analytics, equity curves, and performance metrics.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/upload"
              className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-glow flex items-center gap-2 transition-all"
            >
              <Upload className="w-4 h-4" />
              Upload CSV
            </Link>
            <Link
              href="/accounts"
              className="px-6 py-3 rounded-2xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 font-bold text-sm flex items-center gap-2 transition-all"
            >
              <Wallet className="w-4 h-4 text-purple-400" />
              Manage Accounts
            </Link>
          </div>
          <div className="pt-4 border-t border-dark-border grid grid-cols-3 gap-4 text-xs font-mono text-gray-400">
            <div>✓ Cloud Storage</div>
            <div>✓ Multi-Account</div>
            <div>✓ Real-Time Sync</div>
          </div>
        </div>
      )}

      {/* ── Live Trade Stats (only shown if cloud data exists) ─────────────── */}
      {!cloudLoading && hasCloudData && tradeStats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              title="Win Rate"
              value={`${tradeStats.winRate.toFixed(1)}%`}
              icon={Percent}
              variant={tradeStats.winRate >= 50 ? "profit" : "loss"}
              trend={tradeStats.winRate >= 50 ? "up" : "down"}
              trendValue={`${tradeStats.winningTrades}W / ${tradeStats.losingTrades}L`}
            />
            <StatCard
              title="Net Profit"
              value={formatSigned(tradeStats.totalNetProfit)}
              icon={Zap}
              variant={tradeStats.totalNetProfit >= 0 ? "profit" : "loss"}
              trend={tradeStats.totalNetProfit >= 0 ? "up" : "down"}
              trendValue="All Time"
            />
            <StatCard
              title="Total Trades"
              value={tradeStats.totalTrades}
              icon={Layers}
              variant="default"
              subtitle="Cloud journal"
            />
            <StatCard
              title="Winning Trades"
              value={tradeStats.winningTrades}
              icon={CheckCircle2}
              variant="profit"
            />
            <StatCard
              title="Losing Trades"
              value={tradeStats.losingTrades}
              icon={XCircle}
              variant="loss"
            />
            <StatCard
              title="Breakeven"
              value={tradeStats.breakevenTrades}
              icon={MinusCircle}
              variant="default"
            />
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { href: "/journal",  icon: Layers,   label: "Open Trade Journal",    desc: `${tradeStats.totalTrades} trades in cloud`, color: "text-purple-400" },
              { href: "/accounts", icon: Wallet,   label: "Trading Accounts",      desc: `${accounts.length} account${accounts.length !== 1 ? "s" : ""} connected`, color: "text-indigo-400" },
              { href: "/upload",   icon: Upload,   label: "Upload New CSV",         desc: "Import from your broker", color: "text-sky-400" },
            ].map(({ href, icon: Icon, label, desc, color }) => (
              <Link
                key={href}
                href={href}
                className="p-4 rounded-2xl glass-card border border-dark-border hover:border-white/20 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${color}`} />
                  <div>
                    <p className="text-sm font-bold text-white font-mono">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── Charts (lazy loaded) — only shown with data ─────────────────── */}
      {!cloudLoading && hasCloudData && <DashboardCharts />}
    </div>
  );
}
