"use client";

import React, { useState } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useJournalMetrics } from "@/hooks/useJournalMetrics";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { NormalizedTrade } from "@/lib/engine/types";
import { TradeDetailDrawer } from "./TradeDetailDrawer";
import { format, parseISO } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Trash2,
  Eye,
  Search,
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type SortField = "closeTime" | "symbol" | "volume" | "profit" | "rr";
type SortOrder = "asc" | "desc";

export const TradesTable: React.FC = () => {
  const { format: formatCurrency } = useCurrencyFormatter();
  const deleteTrade = useJournalStore((state) => state.deleteTrade);
  const filters = useJournalStore((state) => state.filters);
  const setFilters = useJournalStore((state) => state.setFilters);
  const columnVisibility = useJournalStore((state) => state.columnVisibility);
  const setColumnVisibility = useJournalStore((state) => state.setColumnVisibility);

  const { filteredTrades } = useJournalMetrics();

  const [activeTrade, setActiveTrade] = useState<NormalizedTrade | null>(null);
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<SortField>("closeTime");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [showColMenu, setShowColMenu] = useState<boolean>(false);

  // Sorting
  const sortedTrades = React.useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "closeTime") {
        valA = new Date(a.closeTime).getTime();
        valB = new Date(b.closeTime).getTime();
      } else if (sortField === "rr") {
        valA = a.rr ?? -999;
        valB = b.rr ?? -999;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredTrades, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedTrades.length / pageSize) || 1;
  const paginatedTrades = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTrades.slice(start, start + pageSize);
  }, [sortedTrades, currentPage, pageSize]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="p-4 rounded-2xl glass-card border border-dark-border flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search symbol, ticket, comment..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-dark-card border border-dark-border text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500 transition-colors font-mono"
          />
        </div>

        {/* Filter Dropdowns & Column Menu */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={filters.direction}
            onChange={(e) => setFilters((prev) => ({ ...prev, direction: e.target.value as any }))}
            className="px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-xs font-mono text-gray-300 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Directions</option>
            <option value="LONG">Long</option>
            <option value="SHORT">Short</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as any }))}
            className="px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-xs font-mono text-gray-300 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="WIN">Win</option>
            <option value="LOSS">Loss</option>
            <option value="BREAKEVEN">Breakeven</option>
          </select>

          {/* Column Visibility Toggle Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu(!showColMenu)}
              className="p-2 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-hover text-gray-300 transition-colors flex items-center gap-1.5 text-xs font-mono"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Columns</span>
            </button>

            {showColMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#0F1420] border border-dark-border rounded-xl p-3 shadow-2xl z-50 space-y-2 text-xs font-mono">
                <div className="text-gray-400 font-bold uppercase pb-1 border-b border-dark-border">
                  Toggle Columns
                </div>
                {Object.entries(columnVisibility).map(([colKey, isVisible]) => (
                  <label key={colKey} className="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(e) => setColumnVisibility({ [colKey]: e.target.checked })}
                      className="rounded bg-dark-card border-dark-border text-brand-500"
                    />
                    <span className="capitalize">{colKey}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl glass-card border border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#0C1019] text-gray-400 border-b border-dark-border sticky top-0 z-10">
              <tr>
                {columnVisibility.date && (
                  <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("closeTime")}>
                    <div className="flex items-center gap-1">
                      <span>Close Time</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                )}
                <th className="py-3 px-4">Ticket</th>
                {columnVisibility.symbol && (
                  <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("symbol")}>
                    <div className="flex items-center gap-1">
                      <span>Symbol</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                )}
                {columnVisibility.direction && <th className="py-3 px-4">Type</th>}
                {columnVisibility.lot && (
                  <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("volume")}>
                    <div className="flex items-center gap-1">
                      <span>Lot</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                )}
                {columnVisibility.entry && <th className="py-3 px-4">Entry</th>}
                {columnVisibility.exit && <th className="py-3 px-4">Exit</th>}
                {columnVisibility.pnl && (
                  <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("profit")}>
                    <div className="flex items-center gap-1">
                      <span>Net PnL</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                )}
                {columnVisibility.rr && (
                  <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("rr")}>
                    <div className="flex items-center gap-1">
                      <span>R:R</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                )}
                {columnVisibility.status && <th className="py-3 px-4">Status</th>}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border text-gray-300">
              {paginatedTrades.map((t) => {
                const isWin = t.status === "WIN";
                const isLoss = t.status === "LOSS";

                return (
                  <tr key={t.ticket} className="hover:bg-dark-hover/40 transition-colors">
                    {columnVisibility.date && (
                      <td className="py-3 px-4 text-gray-400">
                        {t.closeTime ? format(parseISO(t.closeTime), "yyyy-MM-dd HH:mm") : "-"}
                      </td>
                    )}
                    <td className="py-3 px-4 text-gray-400 font-mono">{t.ticket}</td>
                    {columnVisibility.symbol && <td className="py-3 px-4 font-bold text-white">{t.symbol}</td>}
                    {columnVisibility.direction && (
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit ${
                            t.direction === "LONG"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {t.direction === "LONG" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {t.direction}
                        </span>
                      </td>
                    )}
                    {columnVisibility.lot && <td className="py-3 px-4">{t.volume}</td>}
                    {columnVisibility.entry && <td className="py-3 px-4">{t.openPrice !== null ? t.openPrice : "-"}</td>}
                    {columnVisibility.exit && <td className="py-3 px-4">{t.closePrice}</td>}
                    {columnVisibility.pnl && (
                      <td className={`py-3 px-4 font-bold ${isWin ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-gray-300"}`}>
                        {t.profit >= 0 ? "+" : ""}
                        {formatCurrency(t.profit)}
                      </td>
                    )}
                    {columnVisibility.rr && (
                      <td className="py-3 px-4 text-brand-300">
                        {t.rr !== null ? `${t.rr} R` : "N/A"}
                      </td>
                    )}
                    {columnVisibility.status && (
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isWin
                              ? "bg-emerald-500/10 text-emerald-400"
                              : isLoss
                              ? "bg-rose-500/10 text-rose-400"
                              : "bg-gray-800 text-gray-300"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setActiveTrade(t)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-card transition-colors"
                          title="View Trade Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete position ${t.ticket}?`)) deleteTrade(t.ticket);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-dark-card transition-colors"
                          title="Delete Position"
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

        {/* Pagination Footer */}
        <div className="p-4 border-t border-dark-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-gray-400">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedTrades.length)} of {sortedTrades.length} positions
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded-lg bg-dark-card border border-dark-border text-gray-300 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border disabled:opacity-40 hover:bg-dark-hover transition-colors"
              >
                Prev
              </button>
              <span className="px-2 font-bold text-white">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border disabled:opacity-40 hover:bg-dark-hover transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <TradeDetailDrawer trade={activeTrade as any} onClose={() => setActiveTrade(null)} />
    </div>
  );
};
