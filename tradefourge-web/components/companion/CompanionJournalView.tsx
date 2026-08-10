"use client";

import React from "react";
import { useCompanionAccount } from "@/context/CompanionAccountContext";
import { TableProperties, Zap } from "lucide-react";
import { DismissibleBanner } from "@/components/common/DismissibleBanner";

export const CompanionJournalView: React.FC = () => {
  const { currentAccount } = useCompanionAccount();
  const trades = currentAccount?.trades ?? [];

  return (
    <div className="space-y-6 font-mono text-xs max-w-7xl mx-auto w-full text-gray-200 pb-12">
      {/* Synchronization Notice Banner (Dismissible & Persisted) */}
      <DismissibleBanner
        storageKey="tfc_journal_sync_banner_hidden"
        title="Automatic Live Terminal Synchronization"
        description={`Journal will synchronize automatically from connected accounts. Position entries, stop losses, and take profits are logged directly from ${currentAccount?.broker || "Terminal"} (#${currentAccount?.accountNumber || "1001"}).`}
        icon={Zap}
        variant="blue"
      />

      {/* Header */}
      <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] flex items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight font-sans flex items-center gap-2">
            <TableProperties className="w-6 h-6 text-blue-400" />
            <span>Trade Journal</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Synchronized trade records for {currentAccount?.broker || "Companion"} ({currentAccount?.balance !== undefined && currentAccount?.balance !== null ? `$${currentAccount.balance.toLocaleString()}` : "Not detected"})
          </p>
        </div>

        <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-bold text-gray-300">
          {trades.length} Executions Logged
        </div>
      </div>

      {/* Demo Table */}
      <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-4 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.08] text-gray-400 text-[10px] uppercase">
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4">Side</th>
                <th className="py-3 px-4">Lots</th>
                <th className="py-3 px-4">Open Price</th>
                <th className="py-3 px-4">Close Price</th>
                <th className="py-3 px-4">Pips</th>
                <th className="py-3 px-4">Close Time</th>
                <th className="py-3 px-4 text-right">Net PnL ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {trades.map((t) => (
                <tr key={t.ticket} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4 text-gray-400 font-bold">#{t.ticket}</td>
                  <td className="py-3.5 px-4 font-extrabold text-white">{t.symbol}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.type === "BUY" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-200">{t.lots}</td>
                  <td className="py-3.5 px-4 text-gray-300">{t.openPrice}</td>
                  <td className="py-3.5 px-4 text-gray-300">{t.closePrice}</td>
                  <td className="py-3.5 px-4 text-gray-400">{t.pips > 0 ? `+${t.pips}` : t.pips}</td>
                  <td className="py-3.5 px-4 text-gray-400 text-[11px]">{t.closeTime}</td>
                  <td className={`py-3.5 px-4 text-right font-extrabold ${t.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {t.profit >= 0 ? "+" : ""}${t.profit.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
