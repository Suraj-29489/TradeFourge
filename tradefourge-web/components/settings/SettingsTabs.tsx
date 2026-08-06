"use client";
// components/settings/SettingsTabs.tsx
// Production Settings Hub with instant persistence across Supabase and localStorage.

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sliders, User, Bell, LineChart, Shield, AlertTriangle, Check, Save,
  Loader2, Trash2, Download, KeyRound, Sun, Moon, Zap
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchUserPreferences,
  updateUserPreferences,
  type UserPreferences,
} from "@/lib/supabase/profile";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useUserProfile } from "@/context/UserProfileContext";
import { deleteAllImports } from "@/lib/supabase/csv-imports";
import { deleteAllTrades, fetchTrades } from "@/lib/supabase/trades";
import { SUPPORTED_CURRENCY_CODES, getCurrencyLabel } from "@/lib/config/currencies";

export const SettingsTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "general" | "profile" | "notifications" | "trading" | "privacy" | "danger"
  >("general");

  const { profile, preferences, refreshProfile, savePreferenceUpdates } = useUserProfile();
  const theme = useJournalStore(s => s.theme);
  const setTheme = useJournalStore(s => s.setTheme);
  const setDisplayCurrency = useJournalStore(s => s.setDisplayCurrency);

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Dev-only debug panel state (never visible in production)
  const isDev = process.env.NODE_ENV === "development";
  const [debugInfo, setDebugInfo] = useState<{
    userId: string | null;
    payload: object | null;
    response: string | null;
    elapsed: string | null;
    timestamp: string | null;
  } | null>(null);

  // Preference state
  const [defaultAccount, setDefaultAccount] = useState("main");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [defaultTradeCurrency, setDefaultTradeCurrency] = useState("USD");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [weekStart, setWeekStart] = useState("Monday");
  const [riskDisplayMode, setRiskDisplayMode] = useState("percentage");

  // Danger Zone Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const prefs = await fetchUserPreferences(user.id);
          if (prefs) {
            setDefaultAccount(prefs.default_account || "main");
            setNotificationsEnabled(prefs.notifications_enabled ?? true);
            setEmailNotifications(prefs.email_notifications ?? true);
            setMarketingEmails(prefs.marketing_emails ?? false);
            setDefaultTradeCurrency(prefs.default_trade_currency || "USD");
            setDateFormat(prefs.date_format || "YYYY-MM-DD");
            setTimeFormat(prefs.time_format || "24h");
            setWeekStart(prefs.week_start || "Monday");
            setRiskDisplayMode(prefs.risk_display_mode || "percentage");
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setErrorToast("User session not found. Please log in again.");
      return;
    }

    setSaving(true);
    setErrorToast(null);
    setSuccessToast(null);
    setDebugInfo(null);

    const updates: Partial<UserPreferences> = {
      default_account: defaultAccount,
      default_chart_theme: theme,
      notifications_enabled: notificationsEnabled,
      email_notifications: emailNotifications,
      marketing_emails: marketingEmails,
      default_trade_currency: defaultTradeCurrency,
      date_format: dateFormat,
      time_format: timeFormat,
      week_start: weekStart,
      risk_display_mode: riskDisplayMode,
    };

    const t0 = performance.now();
    const result = await savePreferenceUpdates(updates);
    const elapsed = `${(performance.now() - t0).toFixed(0)}ms`;

    setDisplayCurrency(defaultTradeCurrency as any);
    setSaving(false);

    // Always capture debug info in development
    if (isDev) {
      setDebugInfo({
        userId,
        payload: updates,
        response: result.success ? "success" : (result.error || "unknown error"),
        elapsed,
        timestamp: new Date().toISOString(),
      });
    }

    if (!result.success) {
      // Display the REAL Supabase error, not a generic message
      const errorMsg = result.error
        ? `Save failed: ${result.error}`
        : "Save failed: Unknown database error. Check the developer console for details.";
      setErrorToast(errorMsg);
      setTimeout(() => setErrorToast(null), 8000);
    } else {
      setSuccessToast("✓ Settings saved and synchronized to Supabase cloud.");
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

  const handleDownloadData = async () => {
    if (!userId) return;
    try {
      const tradesRes = await fetchTrades(userId, {}, 1, 10000, "close_time", false);
      const trades = tradesRes.data?.data || [];
      const exportObject = { profile: profile, trades: trades, exportedAt: new Date().toISOString() };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TradeFourge_Data_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export data backup.");
    }
  };

  const [deletingData, setDeletingData] = useState(false);

  const handleDeleteAccountData = async () => {
    if (confirmText !== "DELETE") return;
    if (!userId) return;
    setDeletingData(true);

    try {
      const resImports = await deleteAllImports(userId);
      if (!resImports.success) {
        setErrorToast(resImports.error || resImports.message);
        setTimeout(() => setErrorToast(null), 4000);
        return;
      }

      const resTrades = await deleteAllTrades(userId);
      if (resTrades.error) {
        setErrorToast(resTrades.error);
        setTimeout(() => setErrorToast(null), 4000);
        return;
      }

      setDeleteModalOpen(false);
      setConfirmText("");

      if (resImports.status === "NOT_FOUND" && (resTrades.data ?? 0) === 0) {
        setSuccessToast("Nothing to delete.");
      } else {
        setSuccessToast("All trading history deleted successfully.");
      }
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete.";
      setErrorToast(msg);
      setTimeout(() => setErrorToast(null), 4000);
    } finally {
      setDeletingData(false);
    }
  };

  const TABS = [
    { id: "general",       label: "General",       icon: Sliders },
    { id: "profile",       label: "Trader Profile",icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "trading",       label: "Trading Prefs", icon: LineChart },
    { id: "privacy",       label: "Privacy & Data",icon: Shield },
    { id: "danger",        label: "Danger Zone",   icon: AlertTriangle },
  ] as const;

  return (
    <div className="space-y-6 text-xs font-mono">
      {/* Settings Navigation Tabs */}
      <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-dark-card border border-dark-border overflow-x-auto">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-dark-hover"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Toasts */}
      {successToast && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-2 font-bold">
          <Check className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}
      {errorToast && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-start gap-2 font-bold">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* DEV-ONLY Debug Panel — never appears in production */}
      {isDev && debugInfo && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 font-mono text-[10px] space-y-1">
          <div className="font-bold text-yellow-400 text-xs flex items-center gap-1.5 mb-2">
            <span>🛠 Developer Debug Panel</span>
            <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-[9px]">DEV ONLY</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <span className="text-gray-400">User ID:</span><span className="text-white truncate">{debugInfo.userId || "null"}</span>
            <span className="text-gray-400">Response:</span><span className={`truncate ${debugInfo.response === "success" ? "text-emerald-400" : "text-rose-400"}`}>{debugInfo.response}</span>
            <span className="text-gray-400">Elapsed:</span><span className="text-white">{debugInfo.elapsed}</span>
            <span className="text-gray-400">Timestamp:</span><span className="text-white">{debugInfo.timestamp}</span>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-gray-400 hover:text-white">Payload Sent →</summary>
            <pre className="mt-1 text-[9px] text-gray-300 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(debugInfo.payload, null, 2)}</pre>
          </details>
        </div>
      )}

      {/* TAB 1: GENERAL SETTINGS */}
      {activeTab === "general" && (
        <form onSubmit={handleSavePreferences} className="p-6 rounded-2xl glass-card border border-dark-border space-y-6">
          <div className="border-b border-dark-border pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-400" />
              General Platform Preferences
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">
              Configure global display currency, date formatting, and application theme.
            </p>
          </div>

          {/* Theme Quick Toggle */}
          <div className="p-4 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Application Theme Mode</span>
              <span className="text-gray-400 text-[11px]">Dark Mode is currently the active institutional theme.</span>
            </div>
            <button
              type="button"
              onClick={() => alert("Light Mode Coming Soon")}
              className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold flex items-center gap-2 hover:bg-purple-500/20 transition-all"
            >
              <Moon className="w-4 h-4 text-purple-400" />
              <span>Dark Mode Only</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-300 font-bold block mb-1">Display Currency</label>
              <select
                value={defaultTradeCurrency}
                onChange={(e) => setDefaultTradeCurrency(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-dark-card border border-dark-border text-white focus:border-purple-500"
              >
                {SUPPORTED_CURRENCY_CODES.map((c) => (
                  <option key={c} value={c}>{getCurrencyLabel(c)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-gray-300 font-bold block mb-1">Date Format</label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-dark-card border border-dark-border text-white focus:border-purple-500"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO standard)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (European standard)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (US standard)</option>
              </select>
            </div>

            <div>
              <label className="text-gray-300 font-bold block mb-1">Time Format</label>
              <select
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-dark-card border border-dark-border text-white focus:border-purple-500"
              >
                <option value="24h">24-Hour (14:30:00)</option>
                <option value="12h">12-Hour AM/PM (02:30:00 PM)</option>
              </select>
            </div>

            <div>
              <label className="text-gray-300 font-bold block mb-1">Week Start Day</label>
              <select
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-dark-card border border-dark-border text-white focus:border-purple-500"
              >
                <option value="Monday">Monday</option>
                <option value="Sunday">Sunday</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-dark-border">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-2 shadow-glow"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save General Preferences</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: PROFILE */}
      {activeTab === "profile" && <ProfileForm />}

      {/* TAB 3: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <form onSubmit={handleSavePreferences} className="p-6 rounded-2xl glass-card border border-dark-border space-y-6">
          <div className="border-b border-dark-border pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-400" />
              Notifications & Email Alerts
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">
              Control platform notifications, weekly performance summaries, and email alerts.
            </p>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 rounded-xl bg-dark-card border border-dark-border cursor-pointer">
              <div>
                <span className="font-bold text-white block">In-App Notifications</span>
                <span className="text-gray-400 text-[11px]">Receive trade alerts and account updates inside TradeFourge.</span>
              </div>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 accent-purple-600 focus:ring-purple-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-xl bg-dark-card border border-dark-border cursor-pointer">
              <div>
                <span className="font-bold text-white block">Weekly Performance Report Email</span>
                <span className="text-gray-400 text-[11px]">Receive a weekly PDF summary of win rates and net profit in your inbox.</span>
              </div>
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 accent-purple-600 focus:ring-purple-500"
              />
            </label>
          </div>

          <div className="flex justify-end pt-4 border-t border-dark-border">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-2 shadow-glow"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Notifications</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: TRADING PREFERENCES */}
      {activeTab === "trading" && (
        <form onSubmit={handleSavePreferences} className="p-6 rounded-2xl glass-card border border-dark-border space-y-6">
          <div className="border-b border-dark-border pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <LineChart className="w-5 h-5 text-purple-400" />
              Trading Preferences & Risk Display
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">
              Customize risk calculations and default account settings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-300 font-bold block mb-1">Risk Display Mode</label>
              <select
                value={riskDisplayMode}
                onChange={(e) => setRiskDisplayMode(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-dark-card border border-dark-border text-white focus:border-purple-500"
              >
                <option value="percentage">Percentage of Balance (%)</option>
                <option value="currency">Absolute Currency Amount</option>
                <option value="r_multiple">R-Multiple (R)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-dark-border">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-2 shadow-glow"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Trading Preferences</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: PRIVACY & DATA EXPORT */}
      {activeTab === "privacy" && (
        <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-6">
          <div className="border-b border-dark-border pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              Privacy & Account Data Backup
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">
              Download your complete cloud trading journal and profile data as JSON backup.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Download Full Data Archive</span>
              <span className="text-gray-400 text-[11px]">Exports all trade positions, strategy tags, and profile metadata.</span>
            </div>
            <button
              onClick={handleDownloadData}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Export JSON Backup</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 6: DANGER ZONE */}
      {activeTab === "danger" && (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-6">
          <div className="border-b border-rose-500/20 pb-4">
            <h2 className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">
              Irreversible actions. Deleting data cannot be undone.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-dark-card border border-rose-500/30 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Delete All Trading Data</span>
              <span className="text-gray-400 text-[11px]">Deletes all trade records and imported CSV logs from your account.</span>
            </div>
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Trading History</span>
            </button>
          </div>

          {deleteModalOpen && (
            <div className="p-4 rounded-xl bg-black/60 border border-rose-500/40 space-y-3">
              <span className="text-rose-400 font-bold block">Type "DELETE" to confirm complete wipe of trading history:</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-white font-bold"
                />
                <button
                  onClick={handleDeleteAccountData}
                  disabled={confirmText !== "DELETE"}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold disabled:opacity-50"
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-dark-card text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
