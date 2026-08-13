"use client";

import React, { useState } from "react";
import { useMT5Companion } from "@/context/MT5CompanionContext";
import { MT5Header } from "@/components/mt5/MT5Header";
import { PrivacyDisclaimerView } from "@/components/settings/PrivacyDisclaimerView";
import {
  Settings as SettingsIcon,
  Globe,
  Shield,
  ShieldAlert,
  Check,
  RotateCcw,
  Power,
  Trash2,
  Cpu,
  Key,
  Copy,
  RefreshCw,
  Plus,
  Activity,
  History,
} from "lucide-react";
import { MT5Currency } from "@/types/mt5";
import { useTheme } from "@/context/ThemeContext";

export default function MT5SettingsPage() {
  const {
    settings,
    updateSettings,
    accounts,
    selectedAccountId,
    selectAccount,
    disconnectAccount,
    connectors,
    revokeConnector,
    pairNewConnector,
    syncHistory,
    fetchConnectors,
    fetchSyncHistory,
    reconcileHistory,
    isReconciling,
  } = useMT5Companion();

  const { theme } = useTheme();
  const isLight = theme === "light";

  const [activeTab, setActiveTab] = useState<"GENERAL" | "DISPLAY" | "CONNECTORS" | "PRIVACY" | "DANGER">("GENERAL");
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Danger zone confirm dialog state
  const [dangerConfirmAction, setDangerConfirmAction] = useState<string | null>(null);

  // Pairing Modal State
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [userEmailInput, setUserEmailInput] = useState("");
  const [connectorNameInput, setConnectorNameInput] = useState("Desktop MT5 Terminal");
  const [isPairingLoading, setIsPairingLoading] = useState(false);
  const [issuedApiKey, setIssuedApiKey] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Revoke Confirm Modal
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);

  const triggerSave = () => {
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleDisconnectAll = async () => {
    for (const acc of accounts) {
      await disconnectAccount(acc.id);
    }
    setDangerConfirmAction(null);
    triggerSave();
  };

  const handleClearCache = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("tf_mt5_selected_account");
    }
    setDangerConfirmAction(null);
    triggerSave();
  };

  const handleResetSettings = () => {
    updateSettings({
      autoRefresh: true,
      autoRefreshInterval: 30,
      defaultHistoryRange: "Recent Trades",
      defaultTradeSide: "ALL",
      timeFormat: "24h",
      dateFormat: "DD/MM/YYYY",
      timezone: "UTC",
      currency: "USD",
    });
    setDangerConfirmAction(null);
    triggerSave();
  };

  const handlePairConnectorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmailInput.trim()) return;
    setIsPairingLoading(true);
    setPairingError(null);
    setIssuedApiKey(null);

    const result = await pairNewConnector(userEmailInput.trim(), connectorNameInput.trim() || "Desktop MT5 Terminal");
    setIsPairingLoading(false);

    if (result) {
      setIssuedApiKey(result.apiKey);
    } else {
      setPairingError("Failed to pair connector. Verify email address and backend status.");
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTargetId) return;
    await revokeConnector(revokeTargetId);
    setRevokeTargetId(null);
    triggerSave();
  };

  const handleCopyKey = () => {
    if (issuedApiKey && typeof navigator !== "undefined") {
      navigator.clipboard.writeText(issuedApiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <MT5Header
        title="MT5 SETTINGS"
        subtitle="Configure MT5 Companion Preferences, API Connectors, Display Formatting & Safety"
      />

      {/* Settings Navigation Tabs */}
      <div className={`flex items-center gap-2 p-1.5 rounded-2xl border font-mono text-xs overflow-x-auto ${isLight ? "bg-slate-100 border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
        <button
          onClick={() => setActiveTab("GENERAL")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
            activeTab === "GENERAL"
              ? isLight
                ? "bg-white text-emerald-800 shadow-sm border border-slate-200"
                : "bg-blue-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <SettingsIcon className="w-4 h-4" /> General
        </button>

        <button
          onClick={() => setActiveTab("CONNECTORS")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
            activeTab === "CONNECTORS"
              ? isLight
                ? "bg-white text-emerald-800 shadow-sm border border-slate-200"
                : "bg-blue-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Cpu className="w-4 h-4" /> API Connectors ({connectors.length})
        </button>

        <button
          onClick={() => setActiveTab("DISPLAY")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
            activeTab === "DISPLAY"
              ? isLight
                ? "bg-white text-emerald-800 shadow-sm border border-slate-200"
                : "bg-blue-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Globe className="w-4 h-4" /> Display
        </button>

        <button
          onClick={() => setActiveTab("PRIVACY")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
            activeTab === "PRIVACY"
              ? isLight
                ? "bg-white text-emerald-800 shadow-sm border border-slate-200"
                : "bg-blue-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Shield className="w-4 h-4" /> Privacy & Disclaimers
        </button>

        <button
          onClick={() => setActiveTab("DANGER")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
            activeTab === "DANGER"
              ? "bg-rose-600 text-white shadow-md"
              : "text-rose-500 hover:bg-rose-500/10"
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Danger Zone
        </button>
      </div>

      {savedFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-mono text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4" /> MT5 Companion Settings Saved Successfully
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "GENERAL" && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 font-mono text-xs ${
            isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
          }`}
        >
          <h2 className="text-base font-bold font-sans tracking-tight border-b pb-3 border-slate-200 dark:border-white/[0.08]">
            General MT5 Companion Controls
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Default Account Selector */}
            <div className="space-y-2">
              <label className="block font-bold">Default Active Account</label>
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  selectAccount(e.target.value);
                  triggerSave();
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold ${
                  isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white/[0.04] border-white/[0.1] text-white"
                }`}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountNumber} ({acc.server})
                  </option>
                ))}
              </select>
            </div>

            {/* Auto Refresh Toggle */}
            <div className="space-y-2">
              <label className="block font-bold">Auto Refresh</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ autoRefresh: !settings.autoRefresh });
                    triggerSave();
                  }}
                  className={`px-4 py-2 rounded-xl font-bold border transition-all ${
                    settings.autoRefresh
                      ? "bg-emerald-600 text-white border-emerald-500"
                      : "bg-slate-200 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-500 dark:text-gray-400"
                  }`}
                >
                  {settings.autoRefresh ? "ON" : "OFF"}
                </button>
                <span className="text-slate-500 dark:text-gray-400 text-[11px]">
                  Automatically refresh terminal metrics in background
                </span>
              </div>
            </div>

            {/* Auto Refresh Interval */}
            <div className="space-y-2">
              <label className="block font-bold">Auto Refresh Interval</label>
              <select
                value={settings.autoRefreshInterval}
                onChange={(e) => {
                  updateSettings({ autoRefreshInterval: Number(e.target.value) });
                  triggerSave();
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold ${
                  isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white/[0.04] border-white/[0.1] text-white"
                }`}
              >
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
              </select>
            </div>

            {/* Default Trade History */}
            <div className="space-y-2">
              <label className="block font-bold">Default Trade History Scope</label>
              <select
                value={settings.defaultHistoryRange}
                onChange={(e) => {
                  updateSettings({ defaultHistoryRange: e.target.value as any });
                  triggerSave();
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold ${
                  isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white/[0.04] border-white/[0.1] text-white"
                }`}
              >
                <option value="Recent Trades">Recent Trades</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 30 Days">Last 30 Days</option>
                <option value="All Available">All Available</option>
              </select>
            </div>

            {/* Default Trade Side */}
            <div className="space-y-2">
              <label className="block font-bold">Default Trade Side Filter</label>
              <select
                value={settings.defaultTradeSide}
                onChange={(e) => {
                  updateSettings({ defaultTradeSide: e.target.value as any });
                  triggerSave();
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold ${
                  isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white/[0.04] border-white/[0.1] text-white"
                }`}
              >
                <option value="ALL">All Sides</option>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* CONNECTORS TAB */}
      {activeTab === "CONNECTORS" && (
        <div className="space-y-6">
          <div
            className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 font-mono text-xs ${
              isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-white/[0.08]">
              <div>
                <h2 className="text-base font-bold font-sans tracking-tight">
                  Registered MT5 API Connectors
                </h2>
                <p className="text-slate-500 dark:text-gray-400 text-xs font-sans">
                  Manage API keys for local desktop Python MT5 bridge connectors.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={isReconciling}
                  onClick={async () => {
                    const res = await reconcileHistory(30);
                    alert(res.message);
                  }}
                  className={`px-3.5 py-2 rounded-xl border font-bold flex items-center gap-1.5 transition-all ${
                    isReconciling
                      ? "bg-amber-500/10 text-amber-500 border-amber-500/30 cursor-wait"
                      : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                  }`}
                >
                  <History className={`w-3.5 h-3.5 ${isReconciling ? "animate-spin" : ""}`} />
                  {isReconciling ? "Reconciling..." : "Reconcile History"}
                </button>
                <button
                  onClick={() => {
                    fetchConnectors();
                    fetchSyncHistory();
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 font-bold flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
                <button
                  onClick={() => setIsPairModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-4 h-4" /> Pair New Connector
                </button>
              </div>
            </div>

            {connectors.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-300 dark:border-white/10 text-center space-y-3">
                <Cpu className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="font-sans font-bold text-sm">No Active MT5 Connectors</h3>
                <p className="text-slate-500 dark:text-gray-400 max-w-md mx-auto text-[11px]">
                  Pair a local MT5 Connector instance to sync live trades and account statistics directly into TradeForge.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {connectors.map((conn) => (
                  <div
                    key={conn.id}
                    className="p-5 rounded-2xl border bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm font-sans flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-blue-500" />
                        {conn.connector_name}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                          conn.status === "active"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-500 border border-rose-500/30"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        {conn.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-gray-400">
                      <div className="flex justify-between">
                        <span>API Key Prefix:</span>
                        <span className="font-mono text-slate-900 dark:text-white font-bold">
                          {conn.api_key_prefix}...
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Heartbeat:</span>
                        <span className="font-mono text-slate-900 dark:text-white">
                          {conn.last_heartbeat
                            ? new Date(conn.last_heartbeat).toLocaleString()
                            : "Never"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Software Version:</span>
                        <span className="font-mono text-slate-900 dark:text-white">
                          v{conn.version || "1.0.0"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Paired Accounts:</span>
                        <span className="font-mono text-slate-900 dark:text-white font-bold">
                          {conn.paired_accounts}
                        </span>
                      </div>
                    </div>

                    {conn.status === "active" && (
                      <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex justify-end">
                        <button
                          onClick={() => setRevokeTargetId(conn.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-[11px] flex items-center gap-1.5 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Revoke Connector
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sync History Logs Audit Table */}
          <div
            className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-4 font-mono text-xs ${
              isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-white/[0.08]">
              <h3 className="text-base font-bold font-sans tracking-tight flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-500" />
                MT5 Sync Audit Log History ({syncHistory.length})
              </h3>
            </div>

            {syncHistory.length === 0 ? (
              <p className="text-slate-500 dark:text-gray-400 text-center py-4 text-[11px]">
                No MT5 sync batches logged yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 text-[11px]">
                      <th className="py-2 px-3">Batch ID</th>
                      <th className="py-2 px-3">Batch Type</th>
                      <th className="py-2 px-3">Received</th>
                      <th className="py-2 px-3">Inserted</th>
                      <th className="py-2 px-3">Duplicates</th>
                      <th className="py-2 px-3">Duration</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncHistory.map((batch) => (
                      <tr
                        key={batch.id}
                        className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold">{batch.id.substring(0, 8)}...</td>
                        <td className="py-2.5 px-3 capitalize">{batch.batch_type.replace("_", " ")}</td>
                        <td className="py-2.5 px-3 font-bold">{batch.total_items}</td>
                        <td className="py-2.5 px-3 text-emerald-500 font-bold">+{batch.inserted_count}</td>
                        <td className="py-2.5 px-3 text-slate-400">{batch.duplicate_count}</td>
                        <td className="py-2.5 px-3">{batch.duration_ms}ms</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              batch.status === "success"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : batch.status === "partial"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-rose-500/10 text-rose-500"
                            }`}
                          >
                            {batch.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {new Date(batch.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "DISPLAY" && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 font-mono text-xs ${
            isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
          }`}
        >
          <h2 className="text-base font-bold font-sans tracking-tight border-b pb-3 border-slate-200 dark:border-white/[0.08]">
            Display & Formatting Preferences
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account Currency */}
            <div className="space-y-2">
              <label className="block font-bold">Account Currency</label>
              <select
                value={settings.currency}
                onChange={(e) => {
                  updateSettings({ currency: e.target.value as MT5Currency });
                  triggerSave();
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold ${
                  isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white/[0.04] border-white/[0.1] text-white"
                }`}
              >
                <option value="USD">Account Currency (USD)</option>
                <option value="USC">USC</option>
                <option value="EUR">EUR</option>
              </select>
              <p className="text-[11px] text-slate-500 dark:text-gray-400">
                Default account currency reflects actual MT5 server denomination.
              </p>
            </div>

            {/* Time Format */}
            <div className="space-y-2">
              <label className="block font-bold">Time Format</label>
              <select
                value={settings.timeFormat}
                onChange={(e) => {
                  updateSettings({ timeFormat: e.target.value as any });
                  triggerSave();
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold ${
                  isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white/[0.04] border-white/[0.1] text-white"
                }`}
              >
                <option value="12h">12-hour (02:30 PM)</option>
                <option value="24h">24-hour (14:30)</option>
              </select>
            </div>

            {/* Date Format */}
            <div className="space-y-2">
              <label className="block font-bold">Date Format</label>
              <select
                value={settings.dateFormat}
                onChange={(e) => {
                  updateSettings({ dateFormat: e.target.value as any });
                  triggerSave();
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold ${
                  isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white/[0.04] border-white/[0.1] text-white"
                }`}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <label className="block font-bold">Timezone Display</label>
              <select
                value={settings.timezone}
                onChange={(e) => {
                  updateSettings({ timezone: e.target.value as any });
                  triggerSave();
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold ${
                  isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white/[0.04] border-white/[0.1] text-white"
                }`}
              >
                <option value="Account Time">Account Time (Broker Server)</option>
                <option value="Local Time">Local Time</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === "PRIVACY" && (
        <div className="space-y-4">
          <PrivacyDisclaimerView />
        </div>
      )}

      {activeTab === "DANGER" && (
        <div className="p-6 sm:p-8 rounded-3xl border border-rose-500/30 bg-rose-500/5 space-y-6 font-mono text-xs">
          <div className="flex items-center gap-3 border-b pb-4 border-rose-500/20">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className={`text-base font-bold font-sans ${isLight ? "text-slate-900" : "text-white"}`}>
                MT5 Companion Danger Zone
              </h2>
              <p className={`text-xs font-sans ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                Destructive actions are strictly scoped ONLY to MT5 Companion data. CSV Workspace & Supabase records will not be affected.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Disconnect All */}
            <div
              className={`p-4 rounded-2xl border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isLight ? "bg-white" : "bg-[#0F141C]"
              }`}
            >
              <div>
                <strong className={`font-bold block ${isLight ? "text-slate-900" : "text-white"}`}>
                  Disconnect All MT5 Accounts
                </strong>
                <span className={`text-[11px] ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                  Set connection status of all connected MT5 accounts to Disconnected.
                </span>
              </div>
              <button
                onClick={() => setDangerConfirmAction("DISCONNECT_ALL")}
                className="px-4 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm flex items-center gap-2 shrink-0"
              >
                <Power className="w-4 h-4" /> Disconnect All
              </button>
            </div>

            {/* Clear Cached Data */}
            <div
              className={`p-4 rounded-2xl border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isLight ? "bg-white" : "bg-[#0F141C]"
              }`}
            >
              <div>
                <strong className={`font-bold block ${isLight ? "text-slate-900" : "text-white"}`}>
                  Clear MT5 Companion Cached Data
                </strong>
                <span className={`text-[11px] ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                  Clear local cache storage for MT5 account selections.
                </span>
              </div>
              <button
                onClick={() => setDangerConfirmAction("CLEAR_CACHE")}
                className="px-4 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm flex items-center gap-2 shrink-0"
              >
                <Trash2 className="w-4 h-4" /> Clear Cache
              </button>
            </div>

            {/* Reset Settings */}
            <div
              className={`p-4 rounded-2xl border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isLight ? "bg-white" : "bg-[#0F141C]"
              }`}
            >
              <div>
                <strong className={`font-bold block ${isLight ? "text-slate-900" : "text-white"}`}>
                  Reset MT5 Companion Settings
                </strong>
                <span className={`text-[11px] ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                  Restore default refresh intervals, formatting preferences & side filters.
                </span>
              </div>
              <button
                onClick={() => setDangerConfirmAction("RESET_SETTINGS")}
                className="px-4 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm flex items-center gap-2 shrink-0"
              >
                <RotateCcw className="w-4 h-4" /> Reset Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pair New Connector Modal */}
      {isPairModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
          <div onClick={() => setIsPairModalOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className={`relative z-10 w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 font-mono ${
              isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
            }`}
          >
            <h3 className="text-base font-bold font-sans flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-500" />
              Pair New MT5 Connector
            </h3>

            {issuedApiKey ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4" /> Connector Paired Successfully!
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold">API Key (Plaintext — Copy Now)</label>
                  <p className="text-[11px] text-amber-500">
                    Warning: This key will NEVER be displayed again. Copy it to your local connector configuration now.
                  </p>
                  <div className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs break-all flex items-center justify-between gap-2 border border-slate-800">
                    <span>{issuedApiKey}</span>
                    <button
                      onClick={handleCopyKey}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold flex items-center gap-1 shrink-0"
                    >
                      <Copy className="w-3 h-3" /> {copiedKey ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setIsPairModalOpen(false);
                      setIssuedApiKey(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePairConnectorSubmit} className="space-y-4 text-xs">
                <p className="text-slate-500 dark:text-gray-400 font-sans">
                  Register a local Python desktop connector instance. Provide your TradeForge account email to generate a connector API key.
                </p>

                {pairingError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[11px] font-bold">
                    {pairingError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block font-bold">User TradeForge Email</label>
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={userEmailInput}
                    onChange={(e) => setUserEmailInput(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold ${
                      isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white/[0.04] border-white/[0.1] text-white"
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold">Connector Name</label>
                  <input
                    type="text"
                    required
                    placeholder="My Desktop Workstation"
                    value={connectorNameInput}
                    onChange={(e) => setConnectorNameInput(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold ${
                      isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white/[0.04] border-white/[0.1] text-white"
                    }`}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPairModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPairingLoading}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5"
                  >
                    {isPairingLoading ? "Generating Key..." : "Generate API Key"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Revoke Confirm Modal */}
      {revokeTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
          <div onClick={() => setRevokeTargetId(null)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className={`relative z-10 w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 font-mono ${
              isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
            }`}
          >
            <h3 className="text-base font-bold font-sans text-rose-500 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Revoke API Connector
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-sans">
              Are you sure you want to revoke this connector? Its API key will be immediately invalidated and live sync pings will be rejected.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRevokeTargetId(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevoke}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
              >
                Revoke Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone Action Modal */}
      {dangerConfirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
          <div onClick={() => setDangerConfirmAction(null)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className={`relative z-10 w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 font-mono ${
              isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
            }`}
          >
            <h3 className="text-base font-bold font-sans">Confirm Destructive Action</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-sans">
              Are you sure you want to execute this action? This operation is scoped ONLY to MT5 Companion.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDangerConfirmAction(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (dangerConfirmAction === "DISCONNECT_ALL") handleDisconnectAll();
                  if (dangerConfirmAction === "CLEAR_CACHE") handleClearCache();
                  if (dangerConfirmAction === "RESET_SETTINGS") handleResetSettings();
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
