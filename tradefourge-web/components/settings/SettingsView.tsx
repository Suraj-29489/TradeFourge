"use client";

import React, { useState, useCallback } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS, DisplayCurrency } from "@/lib/config/currency";
import {
  Settings,
  DollarSign,
  Calendar,
  Moon,
  Sun,
  Download,
  Check,
  ShieldAlert,
  BarChart2,
  Database,
} from "lucide-react";


function StatRow({ label, value, valueClass = "text-gray-100 font-bold" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-dark-border last:border-0 text-xs font-mono">
      <span className="text-gray-400">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

export const SettingsView: React.FC = () => {
  const setDisplayCurrency = useJournalStore(s => s.setDisplayCurrency);
  const settings           = useJournalStore(s => s.settings);
  const updateSettings     = useJournalStore(s => s.updateSettings);
  const theme              = useJournalStore(s => s.theme);
  const setTheme           = useJournalStore(s => s.setTheme);

  // Phase 3.0: stats are fetched directly from Supabase now
  // Local metrics hook returns defaults (empty) — Phase 3.1 will wire cloud analytics
  const { format: formatCurrency, currency } = useCurrencyFormatter();


  const [savedSuccess, setSavedSuccess] = useState(false);

  const triggerSaveFeedback = useCallback(() => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  }, []);

  const handleCurrencyChange = useCallback((curr: DisplayCurrency) => {
    setDisplayCurrency(curr);
    triggerSaveFeedback();
  }, [setDisplayCurrency, triggerSaveFeedback]);

  const handleDateFormatChange = useCallback((dateFormat: "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY") => {
    updateSettings({ dateFormat });
    triggerSaveFeedback();
  }, [updateSettings, triggerSaveFeedback]);

  const exportJSON = useCallback(() => {
    // Phase 3.0: export now handled by the cloud trades service (Phase 3.1)
    alert("Cloud export coming in Phase 3.1. Use Import History to review your uploads.");
  }, []);


  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Journal Settings & Preferences
            {savedSuccess && (
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Cloud Journal v3.0 · Supabase Storage · Settings are saved locally
          </p>
        </div>
        <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-brand-400">
          <Settings className="w-6 h-6" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cloud storage info panel (replaces old local-stats panel) */}
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3 md:col-span-2">
          <div className="flex items-center gap-3 pb-3 border-b border-dark-border">
            <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Cloud Storage Info</h3>
              <p className="text-xs text-gray-400">Phase 3.0 — Persistent data is now in Supabase. Detailed analytics coming in Phase 3.1.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 p-4 rounded-xl bg-dark-card border border-dark-border text-xs font-mono">
              <p className="text-gray-400 mb-1">Storage Layer</p>
              <p className="text-white font-bold">Supabase PostgreSQL</p>
            </div>
            <div className="flex-1 p-4 rounded-xl bg-dark-card border border-dark-border text-xs font-mono">
              <p className="text-gray-400 mb-1">RLS Protection</p>
              <p className="text-emerald-400 font-bold">Enabled · Row-Level Security</p>
            </div>
            <div className="flex-1 p-4 rounded-xl bg-dark-card border border-dark-border text-xs font-mono">
              <p className="text-gray-400 mb-1">Display Currency</p>
              <p className="text-white font-bold">{currency}</p>
            </div>
          </div>
        </div>

        {/* Display Currency */}
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Display Currency</h3>
              <p className="text-xs text-gray-400">
                USD: stored values · USC: normalized USD · INR: ×84.5
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {SUPPORTED_CURRENCIES.map(curr => (
              <button
                key={curr}
                onClick={() => handleCurrencyChange(curr)}
                className={`py-2.5 rounded-xl font-mono text-xs font-bold transition-all ${
                  currency === curr
                    ? "bg-brand-600 text-white shadow-glow border border-brand-400"
                    : "bg-dark-card border border-dark-border text-gray-300 hover:bg-dark-hover"
                }`}
              >
                {CURRENCY_LABELS[curr]}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 font-mono">
            {currency === "USC" && "USC: all trade values normalized to USD on import"}
            {currency === "INR" && "INR: displayed values are ×84.5 (internal USD ×84.5)"}
            {currency === "USD" && "USD: values displayed as-is from internal storage"}
          </p>
        </div>

        {/* Theme */}
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
              {theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Application Theme</h3>
              <p className="text-xs text-gray-400">Toggle between dark terminal and light mode</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setTheme("dark"); triggerSaveFeedback(); }}
              className={`py-2.5 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                theme === "dark"
                  ? "bg-brand-600 text-white shadow-glow border border-brand-400"
                  : "bg-dark-card border border-dark-border text-gray-300 hover:bg-dark-hover"
              }`}
            >
              <Moon className="w-3.5 h-3.5" /> Dark
            </button>
            <button
              onClick={() => { setTheme("light"); triggerSaveFeedback(); }}
              className={`py-2.5 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                theme === "light"
                  ? "bg-amber-500 text-white border border-amber-400"
                  : "bg-dark-card border border-dark-border text-gray-300 hover:bg-dark-hover"
              }`}
            >
              <Sun className="w-3.5 h-3.5" /> Light
            </button>
          </div>
        </div>

        {/* Date Format */}
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Date Format</h3>
              <p className="text-xs text-gray-400">Preferred timestamp display format</p>
            </div>
          </div>

          <div className="space-y-2">
            {(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"] as const).map(fmt => (
              <button
                key={fmt}
                onClick={() => handleDateFormatChange(fmt)}
                className={`w-full py-2 px-3 rounded-xl font-mono text-xs font-semibold text-left transition-all ${
                  settings.dateFormat === fmt
                    ? "bg-brand-600 text-white border border-brand-400 shadow-glow"
                    : "bg-dark-card border border-dark-border text-gray-300 hover:bg-dark-hover"
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Export & Backup */}
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Export Backup</h3>
              <p className="text-xs text-gray-400">Download your cloud trade data as JSON — coming in Phase 3.1</p>
            </div>
          </div>

          <button
            onClick={exportJSON}
            className="w-full py-2.5 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-400 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors opacity-60 cursor-not-allowed"
            disabled
          >
            <Database className="w-4 h-4 text-brand-400" />
            Cloud Export — Available in Phase 3.1
          </button>
        </div>
      </div>

      {/* Danger Zone — Cloud data management info */}
      <div className="p-5 rounded-2xl glass-card border border-rose-500/30 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Danger Zone</h3>
            <p className="text-xs text-gray-400">Permanently delete cloud data — managed in Supabase Dashboard</p>
          </div>
        </div>

        <p className="text-xs font-mono text-gray-500 p-3 rounded-xl bg-dark-card border border-dark-border">
          ⚠ Cloud data deletion is managed directly in your Supabase Dashboard for safety. Trade data is protected by Row-Level Security and cannot be bulk-deleted through the app. This prevents accidental data loss.
        </p>
      </div>
    </div>
  );
};
