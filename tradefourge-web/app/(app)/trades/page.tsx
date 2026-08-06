"use client";

import React, { useState } from "react";
import { useCompanionAccount } from "@/context/CompanionAccountContext";
import { useActiveAccount } from "@/context/ActiveAccountContext";
import { Activity, Search, Filter, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

export default function TradesPage() {
  const { currentAccount } = useCompanionAccount();
  const { workspaceMode } = useActiveAccount();

  const [searchTerm, setSearchTerm] = useState("");
  const [sideFilter, setSideFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const trades = currentAccount?.trades ?? [];

  const filteredTrades = trades.filter((t) => {
    const matchesSearch =
      searchTerm === "" ||
      t.ticket.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSide = sideFilter === "ALL" || t.type === sideFilter;
    return matchesSearch && matchesSide;
  });

  const totalPages = Math.ceil(filteredTrades.length / pageSize) || 1;
  const paginatedTrades = filteredTrades.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 font-mono text-xs max-w-7xl mx-auto w-full text-gray-200 pb-12">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight font-sans flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" />
            <span>Terminal Executions</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time trade stream synchronized from {currentAccount?.broker || "Companion"} ({currentAccount?.accountNumber || "No Account"})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-400 font-bold text-xs">
            {filteredTrades.length} Trades Synced
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-2xl bg-[#0F141C] border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search ticket or symbol..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500 transition-all font-mono"
          />
        </div>

        {/* Side Filter Buttons */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs">
          {(["ALL", "BUY", "SELL"] as const).map((side) => (
            <button
              key={side}
              onClick={() => {
                setSideFilter(side);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                sideFilter === side ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-white"
              }`}
            >
              {side}
            </button>
          ))}
        </div>
      </div>

      {/* Trades Table Card */}
      <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-4 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.08] text-gray-400 text-[10px] uppercase">
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Lots</th>
                <th className="py-3 px-4">Open Price</th>
                <th className="py-3 px-4">Close Price</th>
                <th className="py-3 px-4">Open Time</th>
                <th className="py-3 px-4">Close Time</th>
                <th className="py-3 px-4 text-right">Profit ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {paginatedTrades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    No trades match your search filter.
                  </td>
                </tr>
              ) : (
                paginatedTrades.map((t) => (
                  <tr key={t.ticket} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-400">#{t.ticket}</td>
                    <td className="py-3 px-4 font-extrabold text-white">{t.symbol}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.type === "BUY" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-200">{t.lots}</td>
                    <td className="py-3 px-4 text-gray-300">{t.openPrice}</td>
                    <td className="py-3 px-4 text-gray-300">{t.closePrice}</td>
                    <td className="py-3 px-4 text-gray-400 text-[11px]">{t.openTime}</td>
                    <td className="py-3 px-4 text-gray-400 text-[11px]">{t.closeTime}</td>
                    <td className={`py-3 px-4 text-right font-extrabold ${t.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {t.profit >= 0 ? "+" : ""}${t.profit.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.08] text-xs text-gray-400">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
