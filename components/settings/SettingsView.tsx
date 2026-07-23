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
  Download,
  RotateCcw,
  Check,
  ShieldAlert,
} from "lucide-react";

export const SettingsView: React.FC = () => {
  const setDisplayCurrency = useJournalStore((state) => state.setDisplayCurrency);
  const settings = useJournalStore((state) => state.settings);
  const updateSettings = useJournalStore((state) => state.updateSettings);
  const clearJournal = useJournalStore((state) => state.clearJournal);
  const trades = useJournalStore((state) => state.trades);
  const accountBalance = useJournalStore((state) => state.accountBalance);
  const { currency } = useCurrencyFormatter();

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
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(trades, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `trading_journal_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [trades]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Journal Settings &amp; Preferences
            {savedSuccess && (
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-400 mt-1">Configure display currency, date format, and data backups</p>
        </div>

        <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-brand-400">
          <Settings className="w-6 h-6" />
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Display Currency Selector */}
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Display Currency</h3>
              <p className="text-xs text-gray-400">Select preferred currency symbol for UI displays</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {SUPPORTED_CURRENCIES.map((curr) => (
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
            {currency === "USC" && "USC Symbol (¢) Active"}
            {currency === "INR" && "INR Symbol (₹) Active"}
            {currency === "USD" && "USD Symbol ($) Active"}
          </p>
        </div>

        {/* Account Summary */}
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Account Summary</h3>
              <p className="text-xs text-gray-400">Values read directly from imported CSV</p>
            </div>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between py-1.5 border-b border-dark-border">
              <span className="text-gray-400">Current Balance</span>
              <span className={accountBalance !== null ? "text-emerald-400 font-bold" : "text-gray-500"}>
                {accountBalance !== null ? `$${accountBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "N/A"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dark-border">
              <span className="text-gray-400">Floating PnL</span>
              <span className="text-gray-500">N/A</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dark-border">
              <span className="text-gray-400">Total Deposits</span>
              <span className="text-gray-500">N/A</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-400">Total Withdrawals</span>
              <span className="text-gray-500">N/A</span>
            </div>
          </div>
        </div>

        {/* Date Format Preference */}
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
            {(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"] as const).map((fmt) => (
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

        {/* Theme Settings */}
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Application Theme</h3>
              <p className="text-xs text-gray-400">Bloomberg Terminal Dark Mode</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between font-mono text-xs text-gray-300">
            <span>Terminal Dark Obsidian</span>
            <span className="text-emerald-400 font-bold">Active</span>
          </div>
        </div>

        {/* Export & Backup */}
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Export Journal Backup</h3>
              <p className="text-xs text-gray-400">Download complete dataset in JSON format</p>
            </div>
          </div>

          <button
            onClick={exportJSON}
            className="w-full py-2.5 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-brand-400" />
            <span>Export {trades.length} Records (JSON)</span>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-5 rounded-2xl glass-card border border-rose-500/30 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Danger Zone</h3>
            <p className="text-xs text-gray-400">Clear all imported trades and history from IndexedDB</p>
          </div>
        </div>

        <button
          onClick={async () => {
            if (confirm("Permanently clear all trading journal records from local IndexedDB?")) {
              await clearJournal();
              alert("All journal data cleared.");
            }
          }}
          className="py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold flex items-center gap-2 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Clear All Journal Data</span>
        </button>
      </div>
    </div>
  );
};
