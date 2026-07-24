"use client";

import React, { useState, useCallback } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useJournalMetrics } from "@/hooks/useJournalMetrics";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS, DisplayCurrency } from "@/lib/config/currency";
import {
  Settings,
  DollarSign,
  Calendar,
  Moon,
  Sun,
  Download,
  RotateCcw,
  Check,
  ShieldAlert,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Percent,
  Target,
  Clock,
  Zap,
  Database,
} from "lucide-react";
import { format } from "date-fns";

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
  const clearAll           = useJournalStore(s => s.clearAll);
  const theme              = useJournalStore(s => s.theme);
  const setTheme           = useJournalStore(s => s.setTheme);
  const journals           = useJournalStore(s => s.journals);
  const selectedJournalIds = useJournalStore(s => s.selectedJournalIds);
  const accountBalance     = useJournalStore(s => s.accountBalance);
  const accountType        = useJournalStore(s => s.accountType);
  const broker             = useJournalStore(s => s.broker);

  const { stats, filteredTrades, dateRange, activeJournals } = useJournalMetrics();
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
    const data = { journals, exportDate: new Date().toISOString() };
    const url = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const a = document.createElement("a");
    a.href = url;
    a.download = `yamada_journals_backup_${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  }, [journals]);

  const totalTrades = journals.reduce((acc, j) => acc + j.tradeCount, 0);
  const activeTrades = filteredTrades.length;

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
            {journals.length} journal{journals.length !== 1 ? "s" : ""} imported · {selectedJournalIds.length} active · {totalTrades} total trades
          </p>
        </div>
        <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-brand-400">
          <Settings className="w-6 h-6" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Summary — real stats */}
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3 md:col-span-2">
          <div className="flex items-center gap-3 pb-3 border-b border-dark-border">
            <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Account Summary</h3>
              <p className="text-xs text-gray-400">Live statistics from active journals</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Column 1 */}
            <div className="space-y-0">
              <StatRow
                label="Current Balance"
                value={accountBalance !== null ? formatCurrency(accountBalance) : "Unavailable"}
                valueClass={accountBalance !== null ? "text-emerald-400 font-bold" : "text-gray-500"}
              />
              <StatRow label="Net Profit" value={formatCurrency(stats.netProfit)} valueClass={stats.netProfit >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"} />
              <StatRow label="Gross Profit" value={formatCurrency(stats.grossProfit)} valueClass="text-emerald-400 font-bold" />
              <StatRow label="Gross Loss" value={formatCurrency(stats.grossLoss)} valueClass="text-rose-400 font-bold" />
              <StatRow label="Total Commission" value={formatCurrency(stats.totalCommission)} valueClass="text-gray-300 font-bold" />
              <StatRow label="Total Swap" value={formatCurrency(stats.totalSwap)} valueClass="text-gray-300 font-bold" />
            </div>
            {/* Column 2 */}
            <div className="space-y-0">
              <StatRow label="Win Rate" value={`${stats.winRate}%`} valueClass={stats.winRate >= 50 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"} />
              <StatRow label="Win / Loss" value={`${stats.winningTrades}W / ${stats.losingTrades}L`} />
              <StatRow label="Breakeven" value={`${stats.breakevenCount}`} />
              <StatRow label="Total Trades" value={`${stats.totalTrades}`} />
              <StatRow label="Active Trades" value={`${activeTrades}`} />
              <StatRow label="Expectancy" value={formatCurrency(stats.expectancy)} valueClass={stats.expectancy >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"} />
            </div>
            {/* Column 3 */}
            <div className="space-y-0">
              <StatRow label="Profit Factor" value={stats.totalTrades > 0 ? `${stats.profitFactor}` : "—"} valueClass={stats.profitFactor >= 1.5 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"} />
              <StatRow label="Average RR" value={stats.averageRR !== null ? `${stats.averageRR}R` : "N/A"} valueClass="text-brand-300 font-bold" />
              <StatRow label="Avg Win" value={formatCurrency(stats.averageWin)} valueClass="text-emerald-400 font-bold" />
              <StatRow label="Avg Loss" value={formatCurrency(stats.averageLoss)} valueClass="text-rose-400 font-bold" />
              <StatRow label="Largest Win" value={formatCurrency(stats.largestWin)} valueClass="text-emerald-400 font-bold" />
              <StatRow label="Largest Loss" value={formatCurrency(stats.largestLoss)} valueClass="text-rose-400 font-bold" />
            </div>
            {/* Column 4 */}
            <div className="space-y-0">
              <StatRow label="Broker" value={broker} />
              <StatRow label="Account Type" value={accountType} />
              <StatRow label="Display Currency" value={currency} />
              <StatRow label="Journals" value={`${journals.length}`} />
              <StatRow
                label="Date Range"
                value={dateRange ? `${format(dateRange.from, "dd MMM yy")} → ${format(dateRange.to, "dd MMM yy")}` : "—"}
              />
              <StatRow label="Avg Hold Time" value={stats.averageHoldTime} />
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
                USD: stored values · USC: ×100 · INR: ×84.5
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
            {currency === "USC" && "USC: displayed values are ×100 (internal USD ×100)"}
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
              <p className="text-xs text-gray-400">Download complete journal dataset as JSON</p>
            </div>
          </div>

          <button
            onClick={exportJSON}
            className="w-full py-2.5 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <Database className="w-4 h-4 text-brand-400" />
            Export {journals.length} Journal{journals.length !== 1 ? "s" : ""} ({totalTrades} trades) — JSON
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
            <p className="text-xs text-gray-400">Permanently clear all journals and trade data from IndexedDB</p>
          </div>
        </div>

        <button
          onClick={async () => {
            if (confirm(`Permanently delete ALL ${journals.length} journals and ${totalTrades} trades? This cannot be undone.`)) {
              await clearAll();
              alert("All journal data cleared.");
            }
          }}
          className="py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold flex items-center gap-2 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Clear All Journal Data
        </button>
      </div>
    </div>
  );
};
