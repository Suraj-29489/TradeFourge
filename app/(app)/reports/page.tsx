"use client";

import React from "react";
import { ExportToolbar } from "@/components/export/ExportToolbar";
import { FileSpreadsheet, Download, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useJournalMetrics } from "@/hooks/useJournalMetrics";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";

export default function ReportsPage() {
  const { trades, stats } = useJournalMetrics();
  const { format, formatSigned } = useCurrencyFormatter();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            TradeFourge Audit Reports & Export
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
              AUDIT GENERATOR
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Generate production-grade PDF and Excel performance audit reports for prop-firm challenges and investors.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-purple-400">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
      </div>

      {/* Main Export Panel Card */}
      <div className="p-8 rounded-3xl glass-card border border-dark-border space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-dark-border">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-400" /> Executive Performance Summary
            </h2>
            <p className="text-xs text-gray-400">
              Ready to export {trades.length} audited positions into official PDF & Excel format.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ExportToolbar />
          </div>
        </div>

        {/* Quick Report Metric Preview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border">
            <span className="text-xs text-gray-400 font-mono block">Total Net Profit</span>
            <span className={`text-xl font-extrabold font-mono mt-1 block ${stats.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatSigned(stats.netProfit)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border">
            <span className="text-xs text-gray-400 font-mono block">Win Rate</span>
            <span className="text-xl font-extrabold text-purple-400 font-mono mt-1 block">
              {stats.winRate}%
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border">
            <span className="text-xs text-gray-400 font-mono block">Profit Factor</span>
            <span className="text-xl font-extrabold text-white font-mono mt-1 block">
              {stats.profitFactor}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border">
            <span className="text-xs text-gray-400 font-mono block">Audited Trades</span>
            <span className="text-xl font-extrabold text-white font-mono mt-1 block">
              {stats.totalTrades}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs font-mono text-gray-300 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" />
          <span>All reports are dynamically formatted using the active TradeFourge theme and currency settings.</span>
        </div>
      </div>
    </div>
  );
}
