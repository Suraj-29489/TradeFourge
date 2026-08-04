"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchLiveCredentials, updateLiveCredential, deleteLiveCredential } from "@/lib/supabase/live-credentials";
import { runManualSync } from "@/lib/live-sync/sync-engine";
import { ConnectLiveBrokerModal } from "@/components/accounts/ConnectLiveBrokerModal";
import { useUserProfile } from "@/context/UserProfileContext";
import { getUserPlan } from "@/lib/billing/feature-gating";
import type { LiveBrokerCredential } from "@/types/database";
import {
  Radio,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  ShieldCheck,
  Server,
  Lock,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function LiveAccountsPage() {
  const supabase = createClient();
  const { profile } = useUserProfile();
  const [userId, setUserId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<LiveBrokerCredential[]>([]);
  const [loading, setLoading] = useState(true);

  // Syncing state per credential ID
  const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});

  // Modals state
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const isProUser = profile?.role === "owner" || (userId ? getUserPlan(userId).hasLiveSync : false);

  const loadData = async (uid: string) => {
    setLoading(true);
    const { data } = await fetchLiveCredentials(uid);
    setCredentials(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await loadData(user.id);
      } else {
        setLoading(false);
      }
    })();
  }, []);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenConnect = () => {
    if (!isProUser) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setIsConnectModalOpen(true);
  };

  const handleManualSync = async (cred: LiveBrokerCredential) => {
    if (!isProUser) {
      setIsUpgradeModalOpen(true);
      return;
    }
    if (!userId) return;

    setSyncingMap((prev) => ({ ...prev, [cred.id]: true }));
    showToast(`Initiating Live Sync for ${cred.account_name}...`, "success");

    const res = await runManualSync(cred);
    setSyncingMap((prev) => ({ ...prev, [cred.id]: false }));

    if (res.success) {
      showToast(res.message, "success");
    } else {
      showToast(res.message, "error");
    }
    await loadData(userId);
  };

  const handleToggleAutoSync = async (cred: LiveBrokerCredential) => {
    if (!userId) return;
    const newAuto = !cred.auto_sync;
    await updateLiveCredential(cred.id, userId, { auto_sync: newAuto });
    showToast(`Auto-sync ${newAuto ? "enabled" : "disabled"} for ${cred.account_name}.`);
    await loadData(userId);
  };

  const handleDisconnect = async (cred: LiveBrokerCredential) => {
    if (!userId) return;
    if (!confirm(`Are you sure you want to disconnect ${cred.account_name}?`)) return;

    await deleteLiveCredential(cred.id, userId);
    showToast(`Disconnected ${cred.account_name}.`);
    await loadData(userId);
  };

  const getStatusBadge = (status: LiveBrokerCredential["status"]) => {
    switch (status) {
      case "Connected":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connected</span>
          </span>
        );
      case "Syncing":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center gap-1.5 w-fit">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Syncing</span>
          </span>
        );
      case "Authentication Failed":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5 w-fit">
            <AlertTriangle className="w-3 h-3" />
            <span>Auth Failed</span>
          </span>
        );
      case "Server Offline":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 w-fit">
            <Server className="w-3 h-3" />
            <span>Server Offline</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/30 flex items-center gap-1.5 w-fit">
            <span>Disconnected</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 ${
              toastMessage.type === "error"
                ? "bg-rose-950/90 border-rose-500/40 text-rose-200"
                : "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
            }`}
          >
            {toastMessage.type === "error" ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span className="font-bold">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-dark-card to-dark-bg border border-purple-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold text-[10px] uppercase">
              Cloud Mode Engine
            </span>
            {isProUser ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] uppercase">
                Pro Sync Active
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[10px] uppercase">
                Free Plan (CSV Mode)
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2 mt-2">
            <Radio className="w-6 h-6 text-purple-400" />
            <span>Live Broker Synchronization</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Read-only MT5 account linking. Automated closed trade synchronization with duplicate protection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/sync-history"
            className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-200 font-bold transition-all flex items-center gap-2"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Sync Audit Logs</span>
          </Link>

          <button
            onClick={handleOpenConnect}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-glow flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Connect Live Broker</span>
          </button>
        </div>
      </div>

      {/* Main Table / Empty State */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 font-mono space-y-3">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
          <div>Loading connected live accounts...</div>
        </div>
      ) : credentials.length === 0 ? (
        <div className="p-12 rounded-2xl bg-dark-card border border-dark-border text-center space-y-6 max-w-xl mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto">
            <Radio className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">No Live Brokers Connected</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Connect your Exness MetaTrader 5 account using read-only Investor Password to enable automated live trade synchronization.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-left text-xs text-gray-400 space-y-1.5">
            <div className="flex items-center gap-2 text-white font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Read-Only Investor Password Security</span>
            </div>
            <p className="text-[11px]">
              TradeFourge only accesses historical trade data via Investor Passwords. Master passwords are never accepted.
            </p>
          </div>

          <button
            onClick={handleOpenConnect}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-glow text-xs inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Connect Exness MT5 Account</span>
          </button>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-dark-card border border-dark-border space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" />
              <span>Connected Broker Accounts ({credentials.length})</span>
            </h3>
            <span className="text-xs text-gray-400 font-mono">Institutional MT5 Feeds</span>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-3">Broker & Platform</th>
                  <th className="py-3 px-3">Account Name & No</th>
                  <th className="py-3 px-3">Server</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Last Sync</th>
                  <th className="py-3 px-3">Imported Trades</th>
                  <th className="py-3 px-3">Auto Sync</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {credentials.map((cred) => {
                  const isSyncing = syncingMap[cred.id];
                  return (
                    <tr key={cred.id} className="hover:bg-white/5 transition-colors font-mono">
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold flex items-center justify-center shrink-0">
                            EX
                          </div>
                          <div>
                            <div className="font-bold text-white">{cred.broker}</div>
                            <div className="text-[10px] text-gray-400">{cred.platform}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-bold text-white">{cred.account_name}</div>
                        <div className="text-[10px] text-purple-400">#{cred.account_number}</div>
                      </td>

                      <td className="py-3.5 px-3 text-gray-300 font-bold">{cred.server}</td>

                      <td className="py-3.5 px-3">{getStatusBadge(isSyncing ? "Syncing" : cred.status)}</td>

                      <td className="py-3.5 px-3 text-gray-400">
                        {cred.last_sync ? new Date(cred.last_sync).toLocaleString() : "Never"}
                      </td>

                      <td className="py-3.5 px-3 font-bold text-white">
                        {(cred.total_trades || 0).toLocaleString()} trades
                      </td>

                      <td className="py-3.5 px-3">
                        <button
                          onClick={() => handleToggleAutoSync(cred)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                            cred.auto_sync
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-gray-500/10 text-gray-400 border border-gray-500/30"
                          }`}
                        >
                          {cred.auto_sync ? "ENABLED" : "PAUSED"}
                        </button>
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleManualSync(cred)}
                            disabled={isSyncing}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                            <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
                          </button>

                          <button
                            onClick={() => handleDisconnect(cred)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Disconnect Broker"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Connect Modal */}
      {userId && (
        <ConnectLiveBrokerModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          onSuccess={() => {
            setIsConnectModalOpen(false);
            if (userId) loadData(userId);
            showToast("Exness MT5 account connected cleanly!");
          }}
          userId={userId}
        />
      )}

      {/* Pro Plan Upgrade Modal */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsUpgradeModalOpen(false)}
            className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity"
          />
          <div className="relative z-10 w-full max-w-md p-6 rounded-2xl bg-dark-card border border-purple-500/30 space-y-5 text-center font-mono shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-white">Pro Plan Required for Live Sync</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Live Broker Synchronization, automated MT5 feeds, and cloud cross-device sync require an active Pro subscription ($29/mo).
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold transition-all text-xs"
              >
                Cancel
              </button>
              <Link
                href="/billing"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-glow text-xs flex items-center justify-center gap-1.5"
              >
                <span>Upgrade to Pro</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
