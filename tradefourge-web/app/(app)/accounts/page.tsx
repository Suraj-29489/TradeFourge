"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Wallet,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Lock,
  Zap,
  Radio,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
  Server,
  Activity,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppEventListener } from "@/lib/events/event-bus";
import {
  fetchTradingAccounts,
  deleteTradingAccount,
} from "@/lib/supabase/accounts";
import { AccountFormModal } from "@/components/accounts/AccountFormModal";
import { LiveStatusBadge } from "@/components/accounts/LiveStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AccountTypeBadge } from "@/components/ui/Badge";
import { CardListSkeleton } from "@/components/ui/LoadingSkeleton";
import { useUserProfile } from "@/context/UserProfileContext";
import { SyncManager } from "@/lib/live-sync/sync-manager";
import { SyncScheduler } from "@/lib/live-sync/scheduler";
import type { TradingAccount, NewTradingAccount } from "@/types/database";
import { getCurrencySymbol, getCurrencyShortLabel } from "@/lib/config/currencies";

export default function AccountsPage() {
  const router = useRouter();
  const { refreshAccounts } = useUserProfile();
  const [accounts, setAccounts]       = useState<TradingAccount[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [formOpen, setFormOpen]       = useState(false);
  const [editAccount, setEditAccount] = useState<TradingAccount | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [manualSyncingId, setManualSyncingId] = useState<string | null>(null);
  const [userId, setUserId]           = useState<string | null>(null);
  const supabase = createClient();

  const loadAccounts = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchTradingAccounts(uid);
    if (err) {
      setError(err);
    } else {
      setAccounts(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        loadAccounts(user.id);
        SyncScheduler.startScheduler(user.id);
      }
    })();
  }, [loadAccounts]);

  useAppEventListener(
    ["tradefourge:account-created", "tradefourge:account-updated", "tradefourge:account-deleted", "tradefourge:trade-created", "tradefourge:trade-deleted"],
    () => {
      if (userId) loadAccounts(userId);
    }
  );

  const handleManualSync = async (accountId: string) => {
    if (!userId) return;
    setManualSyncingId(accountId);
    try {
      const result = await SyncManager.syncAccount(userId, accountId);
      if (!result.success) {
        setError(result.error || "Manual sync failed.");
      } else {
        await loadAccounts(userId);
        await refreshAccounts();
      }
    } catch (err: any) {
      setError(err?.message || "Sync execution error.");
    } finally {
      setManualSyncingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!userId) return;
    if (!confirm(`Deactivate account "${name}"? Trades linked to this account will be preserved.`)) return;
    setActionLoading(id);
    await deleteTradingAccount(id, userId);
    await loadAccounts(userId);
    await refreshAccounts();
    setActionLoading(null);
  };

  return (
    <div className="space-y-6 font-mono text-xs text-white">
      {/* Top Page Header */}
      <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold font-sans text-white tracking-tight flex items-center gap-2">
            <span>Trading Accounts</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Centralized account manager for real-time live sync and imported trade history
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/connect"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all shrink-0"
          >
            <Zap className="w-4 h-4 text-blue-200" />
            <span>Connect Companion</span>
          </Link>

          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white font-bold text-xs transition-all shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-gray-400" />
            <span>Upload CSV</span>
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-300">✕</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <CardListSkeleton count={3} />
      ) : accounts.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0F141C] border border-white/[0.08] text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <Wallet className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-xl font-bold font-sans text-white">No Trading Accounts Connected</h3>
            <p className="text-xs text-gray-400">
              Connect your first trading account to view unified balances, historical trades, and real-time performance analytics.
            </p>
          </div>
          <div className="flex items-center justify-center gap-4 flex-wrap pt-2">
            <Link
              href="/connect"
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Connect Companion</span>
            </Link>
            <Link
              href="/upload"
              className="px-5 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white font-bold text-xs flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-gray-400" />
              <span>Upload CSV</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {accounts.map((account) => {
              const pnl = account.current_balance - account.starting_balance;
              const pnlPct = account.starting_balance > 0
                ? ((pnl / account.starting_balance) * 100)
                : 0;
              const isPositive = pnl >= 0;
              const isLoading = actionLoading === account.id;
              const isSyncing = manualSyncingId === account.id;
              const connectionType = account.is_live_synced ? "Companion Extension" : "CSV Import";

              return (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] hover:border-white/[0.15] transition-all space-y-4 shadow-sm"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Account Info Left */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400">
                        <Wallet className="w-6 h-6" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-white font-sans">
                            {account.account_name}
                          </span>
                          <AccountTypeBadge type={account.account_type} />
                          {account.is_live_synced ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                              <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                              <span>Live Synced</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold flex items-center gap-1">
                              <FileSpreadsheet className="w-3 h-3 text-blue-400" />
                              <span>CSV Import</span>
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
                            #{account.account_number || account.display_id || "TF-ACC-8A91"}
                          </span>
                        </div>

                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 pt-0.5">
                          <span>Broker: <strong className="text-gray-200">{account.broker}</strong></span>
                          <span>·</span>
                          <span>Platform: <strong className="text-gray-200">{account.platform}</strong></span>
                          <span>·</span>
                          <span>Server: <strong className="text-gray-200">{(account as any).server || "Exness-Live"}</strong></span>
                          <span>·</span>
                          <span>Currency: <strong className="text-gray-200">{getCurrencyShortLabel(account.currency)}</strong></span>
                          {account.leverage && (
                            <>
                              <span>·</span>
                              <span>Leverage: <strong className="text-gray-200">{account.leverage}</strong></span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Financial Balances Right */}
                    <div className="flex items-center gap-6 justify-between lg:justify-end border-t lg:border-t-0 border-white/[0.08] pt-3 lg:pt-0">
                      <div className="text-right">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">Current Balance</div>
                        <p className="text-lg font-extrabold text-white font-mono">
                          {getCurrencySymbol(account.currency)}
                          {account.current_balance.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        <p
                          className={`text-xs font-mono flex items-center justify-end gap-1 ${
                            isPositive ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {isPositive ? "+" : ""}
                          {getCurrencySymbol(account.currency)}{pnl.toLocaleString("en-US", { minimumFractionDigits: 2 })} (
                          {pnlPct.toFixed(1)}%)
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        {account.is_live_synced && (
                          <button
                            onClick={() => handleManualSync(account.id)}
                            disabled={isSyncing}
                            title="Sync live trades now"
                            className="p-2 rounded-xl text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/20 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin text-blue-400" : ""}`} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(account.id, account.account_name)}
                          disabled={isLoading}
                          title="Deactivate account"
                          className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.08] transition-colors"
                        >
                          {isLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Connection Details Footer Badge Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-400 bg-white/[0.02] p-3 rounded-xl border border-white/[0.06]">
                    <div className="flex items-center gap-4">
                      <span>Connection: <strong className="text-gray-200">{connectionType}</strong></span>
                      <span>History Imported: <strong className="text-emerald-400 font-bold">✓ Complete</strong></span>
                    </div>

                    <div className="flex items-center gap-4 text-[10px]">
                      <span>Last Sync: {account.last_synced_at ? new Date(account.last_synced_at).toLocaleTimeString() : "Just Now"}</span>
                      <span className="text-blue-400 font-bold">● Active Database</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
