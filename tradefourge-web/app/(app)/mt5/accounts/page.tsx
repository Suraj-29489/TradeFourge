"use client";

import React, { useState } from "react";
import { useMT5Companion } from "@/context/MT5CompanionContext";
import { MT5Header } from "@/components/mt5/MT5Header";
import { MT5StatusBadge } from "@/components/mt5/MT5StatusBadge";
import { AddMT5AccountModal } from "@/components/mt5/AddMT5AccountModal";
import {
  Plus,
  RefreshCw,
  Power,
  Eye,
  EyeOff,
  Shield,
  Server,
  Lock,
  MoreHorizontal,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export default function MT5AccountsPage() {
  const {
    accounts,
    refreshAccount,
    disconnectAccount,
    selectedAccountId,
    selectAccount,
  } = useMT5Companion();

  const { theme } = useTheme();
  const isLight = theme === "light";

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [refreshingAccId, setRefreshingAccId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [disconnectConfirmId, setDisconnectConfirmId] = useState<string | null>(null);

  // Toggle password visibility with auto-hide timer (7 seconds)
  const toggleShowPassword = (accId: string) => {
    setVisiblePasswords((prev) => {
      const isCurrentlyVisible = !!prev[accId];
      if (!isCurrentlyVisible) {
        // Auto-hide after 7 seconds
        setTimeout(() => {
          setVisiblePasswords((p) => ({ ...p, [accId]: false }));
        }, 7000);
      }
      return { ...prev, [accId]: !isCurrentlyVisible };
    });
  };

  const handleRefreshSingle = async (accId: string) => {
    setRefreshingAccId(accId);
    try {
      await refreshAccount(accId);
    } finally {
      setRefreshingAccId(null);
    }
  };

  const handleDisconnectConfirm = async (accId: string) => {
    await disconnectAccount(accId);
    setDisconnectConfirmId(null);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header & Page Title */}
      <MT5Header
        title="MT5 ACCOUNTS"
        subtitle="Manage connected MetaTrader 5 trading accounts, credentials & server parameters"
      />

      {/* Top Control Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight font-sans">
            Connected Accounts ({accounts.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 font-sans">
            Select an account to make it active across MT5 Companion
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add MT5 Account</span>
        </button>
      </div>

      {/* Accounts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {accounts.map((acc) => {
          const isSelected = acc.id === selectedAccountId || acc.accountNumber === selectedAccountId;
          const isPasswordShown = !!visiblePasswords[acc.id];
          const isRefreshingThis = refreshingAccId === acc.id;

          return (
            <div
              key={acc.id}
              onClick={() => selectAccount(acc.id)}
              className={`relative p-6 sm:p-7 rounded-3xl border transition-all duration-200 space-y-6 flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? isLight
                    ? "bg-white border-2 border-emerald-600 shadow-xl"
                    : "bg-[#0F141C] border-2 border-blue-500 shadow-xl"
                  : isLight
                  ? "bg-white border-slate-200 hover:border-emerald-500/50"
                  : "bg-[#0F141C] border-white/[0.08] hover:border-blue-500/50"
              }`}
            >
              {/* Card Header */}
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-extrabold font-mono text-slate-900 dark:text-white">
                        {acc.accountNumber}
                      </h3>
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Active Selection
                        </span>
                      )}
                      {acc.isPaired && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          API Paired
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-slate-500 dark:text-gray-400">
                      {acc.accountType} • {acc.currency}
                    </span>
                  </div>

                  <MT5StatusBadge status={acc.connectionStatus} size="sm" />
                </div>

                {/* Account Properties */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] text-xs font-mono">
                  <div>
                    <span className="text-slate-500 dark:text-gray-400 text-[10px] block">Server</span>
                    <strong className="text-slate-900 dark:text-white truncate block">{acc.server}</strong>
                  </div>

                  <div>
                    <span className="text-slate-500 dark:text-gray-400 text-[10px] block">Leverage</span>
                    <strong className="text-slate-900 dark:text-white block">{acc.leverage}</strong>
                  </div>

                  <div>
                    <span className="text-slate-500 dark:text-gray-400 text-[10px] block">Balance</span>
                    <strong className="text-slate-900 dark:text-white block">${acc.balance.toFixed(2)}</strong>
                  </div>

                  <div>
                    <span className="text-slate-500 dark:text-gray-400 text-[10px] block">Equity</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 block">${acc.equity.toFixed(2)}</strong>
                  </div>
                </div>

                {/* Security Section */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-slate-500 dark:text-gray-400">Security Mode:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">
                      {acc.isPaired ? "API Key Authenticated (Read-Only)" : "Unpaired"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-xs font-mono">
                <span className="text-[11px] text-slate-500 dark:text-gray-400">
                  Last sync: {new Date(acc.lastUpdated).toLocaleTimeString()}
                </span>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleRefreshSingle(acc.id)}
                    disabled={isRefreshingThis}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      isLight
                        ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                        : "bg-white/[0.04] border-white/[0.1] text-gray-200 hover:bg-white/[0.08]"
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingThis ? "animate-spin text-emerald-500" : ""}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    onClick={() => setDisconnectConfirmId(acc.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-rose-500 hover:bg-rose-500/10 border-rose-500/20 transition-colors"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Account Modal */}
      <AddMT5AccountModal open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

      {/* Disconnect Confirmation Modal */}
      {disconnectConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
          <div onClick={() => setDisconnectConfirmId(null)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className={`relative z-10 w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 font-mono ${
              isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
            }`}
          >
            <h3 className="text-base font-bold font-sans">Disconnect Account?</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-sans">
              This will set the MT5 account connection status to Disconnected. No historical data will be lost.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDisconnectConfirmId(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDisconnectConfirm(disconnectConfirmId)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
