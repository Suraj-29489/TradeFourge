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
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppEventListener } from "@/lib/events/event-bus";
import {
  fetchTradingAccounts,
  deleteTradingAccount,
} from "@/lib/supabase/accounts";
import { AccountFormModal } from "@/components/accounts/AccountFormModal";
import { CardListSkeleton } from "@/components/ui/LoadingSkeleton";
import { useUserProfile } from "@/context/UserProfileContext";
import { useActiveAccount } from "@/context/ActiveAccountContext";
import type { TradingAccount, NewTradingAccount } from "@/types/database";
import { getCurrencySymbol, getCurrencyShortLabel } from "@/lib/config/currencies";

import { CompanionAccountsView } from "@/components/companion/CompanionAccountsView";

export default function AccountsPage() {
  const { workspaceMode } = useActiveAccount();

  if (workspaceMode === "tfc") {
    return <CompanionAccountsView />;
  }

  const router = useRouter();
  const { refreshAccounts } = useUserProfile();
  const { activeAccountId, setActiveAccountId } = useActiveAccount();

  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<TradingAccount | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
      }
    })();
  }, [loadAccounts]);

  useAppEventListener(
    ["tradefourge:account-created", "tradefourge:account-updated", "tradefourge:account-deleted"],
    () => {
      if (userId) loadAccounts(userId);
    }
  );

  const handleCreateAccountSubmitted = async (data: NewTradingAccount) => {
    const supabaseClient = createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: newAcc } = await supabaseClient
      .from("trading_accounts")
      .insert({
        ...data,
        user_id: user.id,
      } as any)
      .select()
      .single();

    if (newAcc) {
      await loadAccounts(user.id);
      await refreshAccounts();
      setActiveAccountId(newAcc.id);
      setFormOpen(false);
      // Redirect directly to CSV Upload page for that account (PART 5 requirement)
      router.push("/upload");
    }
  };

  const handleEditAccountSubmitted = async (data: NewTradingAccount) => {
    if (!editAccount || !userId) return;
    const { error: err } = await supabase
      .from("trading_accounts")
      .update(data as any)
      .eq("id", editAccount.id)
      .eq("user_id", userId);

    if (err) {
      setError(err.message);
    } else {
      await loadAccounts(userId);
      await refreshAccounts();
      setEditAccount(null);
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

  const handleSwitchAccount = (id: string) => {
    setActiveAccountId(id);
  };

  return (
    <div className="space-y-6 font-mono text-gray-200 max-w-7xl mx-auto w-full">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white font-sans flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-400" />
            <span>Accounts</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manage your CSV trading workspaces.
          </p>
        </div>

        <button
          onClick={() => {
            setEditAccount(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Account</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-300">✕</button>
        </div>
      )}

      {/* Content Grid */}
      {loading ? (
        <CardListSkeleton count={3} />
      ) : accounts.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0F141C] border border-white/[0.08] text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-xl font-bold font-sans text-white">No CSV Accounts Found</h3>
            <p className="text-xs text-gray-400">
              Create your first CSV workspace to start uploading and analyzing historical trading statements.
            </p>
          </div>
          <button
            onClick={() => {
              setEditAccount(null);
              setFormOpen(true);
            }}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Account</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {accounts.map((account) => {
              const isActive = activeAccountId === account.id;
              const isLoading = actionLoading === account.id;
              const currencySymbol = getCurrencySymbol(account.currency);
              const pnl = account.current_balance - account.starting_balance;
              const isPositive = pnl >= 0;

              return (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`p-6 rounded-2xl border transition-all space-y-4 shadow-sm ${
                    isActive
                      ? "bg-blue-500/10 border-blue-500/60 shadow-lg shadow-blue-500/5"
                      : "bg-[#0F141C] border-white/[0.08] hover:border-white/[0.15]"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Account Info Left */}
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                        isActive ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "bg-white/[0.03] border-white/[0.08] text-gray-400"
                      }`}>
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-white font-sans">
                            {account.account_name}
                          </span>
                          {isActive ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-blue-400" />
                              <span>Active Workspace</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-white/[0.04] text-gray-400 border border-white/[0.08] text-[10px] font-bold">
                              CSV Account
                            </span>
                          )}
                        </div>

                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 pt-0.5">
                          <span>Broker: <strong className="text-gray-200">{account.broker || "CSV"}</strong></span>
                          <span>·</span>
                          <span>Currency: <strong className="text-gray-200">{getCurrencyShortLabel(account.currency)}</strong></span>
                          <span>·</span>
                          <span>Account Type: <strong className="text-gray-200">{account.account_type}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Balances & Actions Right */}
                    <div className="flex items-center gap-6 justify-between lg:justify-end border-t lg:border-t-0 border-white/[0.08] pt-3 lg:pt-0">
                      <div className="text-right">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">Current Balance</div>
                        <p className="text-lg font-extrabold text-white font-mono">
                          {currencySymbol}
                          {account.current_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {!isActive && (
                          <button
                            onClick={() => handleSwitchAccount(account.id)}
                            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-sm"
                          >
                            Switch Workspace
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setEditAccount(account);
                            setFormOpen(true);
                          }}
                          title="Edit account details"
                          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

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

                  {/* Account Summary Footer Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-400 bg-white/[0.02] p-3 rounded-xl border border-white/[0.06]">
                    <div className="flex items-center gap-4">
                      <span>Broker: <strong className="text-gray-200">{account.broker || "Generic CSV"}</strong></span>
                      <span>Platform: <strong className="text-gray-200">{account.platform || "CSV Import"}</strong></span>
                    </div>

                    <div className="flex items-center gap-4 text-[10px]">
                      <span>Last Import: <strong className="text-gray-300">{account.last_synced_at ? new Date(account.last_synced_at).toLocaleDateString() : "No imports yet"}</strong></span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Account Create / Edit Form Modal */}
      <AccountFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditAccount(null);
        }}
        onSubmit={editAccount ? handleEditAccountSubmitted : handleCreateAccountSubmitted}
        account={editAccount}
      />
    </div>
  );
}
