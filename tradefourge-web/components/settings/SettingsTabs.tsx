"use client";
// components/settings/SettingsTabs.tsx
// Simplified Settings Hub with General, Privacy, and Danger Zone tabs only.

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sliders, Shield, AlertTriangle, Check, Save, Loader2, Trash2, Download, Zap
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchUserPreferences,
  updateUserPreferences,
  type UserPreferences,
} from "@/lib/supabase/profile";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useUserProfile } from "@/context/UserProfileContext";
import { deleteAllImports } from "@/lib/supabase/csv-imports";
import { deleteAllTrades, fetchTrades } from "@/lib/supabase/trades";
import { SUPPORTED_CURRENCY_CODES, getCurrencyLabel } from "@/lib/config/currencies";
import { PrivacyDisclaimerView } from "@/components/settings/PrivacyDisclaimerView";

import { useActiveAccount } from "@/context/ActiveAccountContext";
import { useCompanionAccount } from "@/context/CompanionAccountContext";

export const SettingsTabs: React.FC = () => {
  const { workspaceMode } = useActiveAccount();
  const { connectionStatus, reconnect, disconnect, extensionInfo } = useCompanionAccount();

  const [activeTab, setActiveTab] = useState<"general" | "privacy" | "danger">("general");

  const { profile, preferences, refreshProfile, savePreferenceUpdates } = useUserProfile();
  const theme = useJournalStore(s => s.theme);
  const setDisplayCurrency = useJournalStore(s => s.setDisplayCurrency);

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Preference state
  const [defaultAccount, setDefaultAccount] = useState("main");
  const [defaultTradeCurrency, setDefaultTradeCurrency] = useState("USD");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [weekStart, setWeekStart] = useState("Monday");

  // Danger Zone Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deletingData, setDeletingData] = useState(false);

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
            setDefaultTradeCurrency(prefs.default_trade_currency || "USD");
            setDateFormat(prefs.date_format || "YYYY-MM-DD");
            setTimeFormat(prefs.time_format || "24h");
            setWeekStart(prefs.week_start || "Monday");
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
    if (!userId) return;
    setSaving(true);
    setSuccessToast(null);
    setErrorToast(null);

    const payload: Partial<UserPreferences> = {
      default_account: defaultAccount,
      default_trade_currency: defaultTradeCurrency,
      date_format: dateFormat,
      time_format: timeFormat,
      week_start: weekStart,
    };

    try {
      const ok = await updateUserPreferences(userId, payload);
      if (ok) {
        setDisplayCurrency(defaultTradeCurrency);
        await savePreferenceUpdates(payload);
        setSuccessToast("Settings saved successfully.");
        setTimeout(() => setSuccessToast(null), 3000);
      } else {
        setErrorToast("Failed to update preferences.");
        setTimeout(() => setErrorToast(null), 4000);
      }
    } catch (err) {
      setErrorToast("Save failed.");
      setTimeout(() => setErrorToast(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (confirmText !== "DELETE ALL DATA") return;
    if (!userId) return;

    setDeletingData(true);
    try {
      const resImports = await deleteAllImports(userId);
      const resTrades = await deleteAllTrades(userId);
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
    { id: "general", label: "General", icon: Sliders },
    { id: "privacy", label: "Privacy & Data", icon: Shield },
    { id: "danger", label: "Danger Zone", icon: AlertTriangle },
  ] as const;

  return (
    <div className="space-y-6 text-xs font-mono max-w-7xl mx-auto w-full pb-12">
      {/* Settings Navigation Tabs */}
      <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-[#0F141C] border border-white/[0.08] overflow-x-auto">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
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
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-2 font-bold font-mono">
          <Check className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}
      {errorToast && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-start gap-2 font-bold font-mono">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* TAB 1: GENERAL SETTINGS */}
      {activeTab === "general" && (
        <form onSubmit={handleSavePreferences} className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-6 shadow-xl font-mono">
          <div className="border-b border-white/[0.08] pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 font-sans">
              <Sliders className="w-5 h-5 text-blue-400" />
              General Platform Preferences
            </h2>
            <p className="text-gray-400 text-xs mt-0.5 font-sans">
              Configure display currency, date formatting, and companion engine runtime.
            </p>
          </div>

          {/* TradeForge Companion Settings (TFC Mode Only) */}
          {workspaceMode === "tfc" && (
            <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-3">
              <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                <span className="font-bold text-white font-sans flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-400 fill-blue-400" />
                  TradeForge Companion Engine
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  connectionStatus === "Connected" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                }`}>
                  ● {connectionStatus}
                </span>
              </div>
              <p className="text-xs text-gray-300 font-sans">
                Extension Runtime: {extensionInfo.version} ({extensionInfo.browser})
              </p>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={reconnect}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-sm"
                >
                  Reconnect
                </button>
                <button
                  type="button"
                  onClick={disconnect}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/10 border border-white/[0.08] text-rose-400 font-bold text-xs transition-colors"
                >
                  Forget Device
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Display Currency */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300 block font-sans">Display Currency</label>
              <select
                value={defaultTradeCurrency}
                onChange={(e) => setDefaultTradeCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-xs focus:border-blue-500 focus:outline-none font-mono"
              >
                {SUPPORTED_CURRENCY_CODES.map((code) => (
                  <option key={code} value={code} className="bg-[#0F141C] text-white">
                    {code} — {getCurrencyLabel(code)}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Format */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300 block font-sans">Date Format</label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-xs focus:border-blue-500 focus:outline-none font-mono"
              >
                <option value="YYYY-MM-DD" className="bg-[#0F141C]">YYYY-MM-DD (2026-08-06)</option>
                <option value="MM/DD/YYYY" className="bg-[#0F141C]">MM/DD/YYYY (08/06/2026)</option>
                <option value="DD/MM/YYYY" className="bg-[#0F141C]">DD/MM/YYYY (06/08/2026)</option>
              </select>
            </div>

            {/* Time Format */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300 block font-sans">Time Format</label>
              <select
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-xs focus:border-blue-500 focus:outline-none font-mono"
              >
                <option value="24h" className="bg-[#0F141C]">24-Hour (14:30)</option>
                <option value="12h" className="bg-[#0F141C]">12-Hour (02:30 PM)</option>
              </select>
            </div>

            {/* Week Start */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300 block font-sans">Week Starts On</label>
              <select
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-xs focus:border-blue-500 focus:outline-none font-mono"
              >
                <option value="Monday" className="bg-[#0F141C]">Monday</option>
                <option value="Sunday" className="bg-[#0F141C]">Sunday</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.08] flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Preferences</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: PRIVACY & DATA */}
      {activeTab === "privacy" && <PrivacyDisclaimerView />}

      {/* TAB 3: DANGER ZONE */}
      {activeTab === "danger" && (
        <div className="p-6 rounded-2xl bg-[#0F141C] border border-rose-500/30 space-y-6 shadow-xl font-mono">
          <div className="border-b border-rose-500/20 pb-4">
            <h2 className="text-lg font-bold text-rose-400 flex items-center gap-2 font-sans">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Danger Zone
            </h2>
            <p className="text-gray-400 text-xs mt-0.5 font-sans">
              Permanent and destructive account operations. Proceed with extreme caution.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-white font-sans text-xs">Purge Trade History & Statements</h4>
              <p className="text-[11px] text-rose-200/80 font-sans">
                Permanently deletes all imported CSV statements and trade logs. This action cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shrink-0 shadow-sm"
            >
              Purge All Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
