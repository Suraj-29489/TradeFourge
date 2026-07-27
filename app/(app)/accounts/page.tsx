"use client";
// app/(app)/accounts/page.tsx
// Cloud-backed Trading Accounts Manager.

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Wallet,
  Star,
  StarOff,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchTradingAccounts,
  createTradingAccount,
  updateTradingAccount,
  deleteTradingAccount,
  setDefaultAccount,
} from "@/lib/supabase/accounts";
import { AccountFormModal } from "@/components/accounts/AccountFormModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { AccountTypeBadge } from "@/components/ui/Badge";
import { CardListSkeleton } from "@/components/ui/LoadingSkeleton";
import type { TradingAccount, NewTradingAccount } from "@/types/database";

export default function AccountsPage() {
  const [accounts, setAccounts]       = useState<TradingAccount[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [formOpen, setFormOpen]       = useState(false);
  const [editAccount, setEditAccount] = useState<TradingAccount | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userId, setUserId]           = useState<string | null>(null);
  const supabase = createClient();

  // ── Load user + accounts ─────────────────────────────────────────────────
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
      }
    })();
  }, []);

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async (data: NewTradingAccount) => {
    if (!userId) return;
    const { error: err } = await createTradingAccount(userId, data);
    if (err) { setError(err); return; }
    setFormOpen(false);
    loadAccounts(userId);
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const handleEdit = async (data: NewTradingAccount) => {
    if (!userId || !editAccount) return;
    const { error: err } = await updateTradingAccount(editAccount.id, userId, data);
    if (err) { setError(err); return; }
    setEditAccount(null);
    loadAccounts(userId);
  };

  // ── Set Default ───────────────────────────────────────────────────────────
  const handleSetDefault = async (id: string) => {
    if (!userId) return;
    setActionLoading(id);
    await setDefaultAccount(id, userId);
    await loadAccounts(userId);
    setActionLoading(null);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string, name: string) => {
    if (!userId) return;
    if (!confirm(`Deactivate account "${name}"? Trades linked to this account will be preserved.`)) return;
    setActionLoading(id);
    await deleteTradingAccount(id, userId);
    await loadAccounts(userId);
    setActionLoading(null);
  };

  const defaultAccount = accounts.find((a) => a.is_default);
  const totalBalance = accounts.reduce((sum, a) => sum + (a.current_balance ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#111726] to-[#182238] border border-white/10 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2 font-mono">
            Trading Accounts
            <span className="text-xs px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
              CLOUD
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manage your broker accounts and track balances
          </p>
        </div>
        <button
          onClick={() => { setEditAccount(null); setFormOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm font-mono shadow-glow transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* Summary Strip */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl glass-card border border-dark-border">
            <p className="text-xs font-mono text-gray-400 mb-1">Total Accounts</p>
            <p className="text-2xl font-extrabold text-white font-mono">{accounts.length}</p>
          </div>
          <div className="p-4 rounded-2xl glass-card border border-dark-border">
            <p className="text-xs font-mono text-gray-400 mb-1">Combined Balance</p>
            <p className="text-2xl font-extrabold text-white font-mono">
              ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-4 rounded-2xl glass-card border border-dark-border">
            <p className="text-xs font-mono text-gray-400 mb-1">Default Account</p>
            <p className="text-base font-bold text-purple-400 font-mono truncate">
              {defaultAccount?.account_name ?? "None set"}
            </p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-300">✕</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <CardListSkeleton count={3} />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No Accounts Yet"
          description="Add your first broker account to start tracking trades, balances, and performance across multiple platforms."
          action={{
            label: "Add Your First Account",
            onClick: () => { setEditAccount(null); setFormOpen(true); },
          }}
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {accounts.map((account) => {
              const pnl = account.current_balance - account.starting_balance;
              const pnlPct = account.starting_balance > 0
                ? ((pnl / account.starting_balance) * 100)
                : 0;
              const isPositive = pnl >= 0;
              const isLoading = actionLoading === account.id;

              return (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="p-5 rounded-2xl glass-card border border-dark-border hover:border-white/20 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left */}
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600/20 to-indigo-700/20 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <Wallet className="w-5 h-5 text-purple-400" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-white font-mono">
                            {account.account_name}
                          </span>
                          {account.is_default && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono bg-purple-600/20 text-purple-400 border border-purple-500/30">
                              Default
                            </span>
                          )}
                          <AccountTypeBadge type={account.account_type} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-mono text-gray-400">
                          <span>{account.broker}</span>
                          <span>·</span>
                          <span>{account.platform}</span>
                          <span>·</span>
                          <span>{account.currency}</span>
                          {account.leverage && (
                            <>
                              <span>·</span>
                              <span>Leverage {account.leverage}</span>
                            </>
                          )}
                          {account.account_number && (
                            <>
                              <span>·</span>
                              <span className="text-gray-500">#{account.account_number}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-6">
                      {/* Balance */}
                      <div className="text-right">
                        <p className="text-lg font-extrabold text-white font-mono">
                          {account.currency}{" "}
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
                          {pnl.toLocaleString("en-US", { minimumFractionDigits: 2 })} (
                          {pnlPct.toFixed(1)}%)
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSetDefault(account.id)}
                          disabled={account.is_default || isLoading}
                          title={account.is_default ? "Already default" : "Set as default"}
                          className="p-2 rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10 disabled:opacity-30 transition-colors"
                        >
                          {account.is_default ? (
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          ) : (
                            <StarOff className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => { setEditAccount(account); setFormOpen(true); }}
                          title="Edit account"
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(account.id, account.account_name)}
                          disabled={isLoading}
                          title="Deactivate account"
                          className="p-2 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-400/10 disabled:opacity-30 transition-colors"
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

                  {/* Notes */}
                  {account.notes && (
                    <p className="mt-3 text-xs text-gray-400 font-mono border-t border-dark-border pt-3">
                      {account.notes}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit Modal */}
      <AccountFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditAccount(null); }}
        onSubmit={editAccount ? handleEdit : handleCreate}
        account={editAccount}
      />
    </div>
  );
}
