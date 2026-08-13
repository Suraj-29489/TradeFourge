"use client";

import React, { useState, useMemo } from "react";
import { useMT5Companion } from "@/context/MT5CompanionContext";
import { MT5Header } from "@/components/mt5/MT5Header";
import { MT5Trade } from "@/types/mt5";
import { MT5TradeDetailDrawer } from "@/components/mt5/MT5TradeDetailDrawer";
import { FetchMT5HistoryModal } from "@/components/mt5/FetchMT5HistoryModal";
import { exportMT5TradesCSV } from "@/lib/export/mt5-csv-exporter";
import {
  Search,
  Download,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useTheme } from "@/context/ThemeContext";

export default function MT5TradesPage() {
  const {
    trades,
    selectedAccount,
    accounts,
    selectedAccountId,
    selectAccount,
    isLoading,
  } = useMT5Companion();

  const { theme } = useTheme();
  const isLight = theme === "light";

  // Filter state
  const [search, setSearch] = useState("");
  const [symbolFilter, setSymbolFilter] = useState("ALL");
  const [sideFilter, setSideFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [quickRange, setQuickRange] = useState<"ALL" | "TODAY" | "7D" | "30D" | "MONTH">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modals / Drawer
  const [selectedTrade, setSelectedTrade] = useState<MT5Trade | null>(null);
  const [isFetchHistoryOpen, setIsFetchHistoryOpen] = useState(false);

  // Symbol list derived from trades
  const uniqueSymbols = useMemo(() => {
    const set = new Set(trades.map((t) => t.symbol));
    return ["ALL", ...Array.from(set)];
  }, [trades]);

  // Handle Quick Ranges
  const handleQuickRange = (range: "ALL" | "TODAY" | "7D" | "30D" | "MONTH") => {
    setQuickRange(range);
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");

    if (range === "TODAY") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (range === "7D") {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(format(past, "yyyy-MM-dd"));
      setEndDate(todayStr);
    } else if (range === "30D") {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(format(past, "yyyy-MM-dd"));
      setEndDate(todayStr);
    } else if (range === "MONTH") {
      const startOfMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-01`;
      setStartDate(startOfMonth);
      setEndDate(todayStr);
    } else {
      setStartDate("");
      setEndDate("");
    }
  };

  // Filtered dataset
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      // Account check
      if (selectedAccountId && t.accountNumber !== selectedAccount?.accountNumber) {
        // If account number differs, skip (state provider already scopes getTrades, but good sanity check)
      }
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          t.ticket.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.orderId.toLowerCase().includes(q);
        if (!matches) return false;
      }
      // Symbol
      if (symbolFilter !== "ALL" && t.symbol.toLowerCase() !== symbolFilter.toLowerCase()) {
        return false;
      }
      // Side
      if (sideFilter !== "ALL" && t.side !== sideFilter) {
        return false;
      }
      // Status
      if (statusFilter !== "ALL" && t.status !== statusFilter) {
        return false;
      }
      // Date Range
      if (startDate) {
        const tDate = t.openTime.split("T")[0];
        if (tDate < startDate) return false;
      }
      if (endDate) {
        const tDate = t.openTime.split("T")[0];
        if (tDate > endDate) return false;
      }

      return true;
    });
  }, [trades, selectedAccountId, selectedAccount, search, symbolFilter, sideFilter, statusFilter, startDate, endDate]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize));
  const pageIndex = Math.min(currentPage, totalPages);
  const paginatedTrades = useMemo(() => {
    const start = (pageIndex - 1) * pageSize;
    return filteredTrades.slice(start, start + pageSize);
  }, [filteredTrades, pageIndex, pageSize]);

  const handleExportCSV = () => {
    exportMT5TradesCSV(filteredTrades, selectedAccount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-28 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse" />
        <div className="h-20 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse" />
        <div className="h-96 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <MT5Header
        title="MT5 TRADES"
        subtitle="Full MT5 Terminal Execution History, Order Filters & CSV Exporter"
      />

      {/* Top Action Bar: Fetch History & Download CSV */}
      <div className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl border font-mono text-xs ${isLight ? "bg-slate-50 border-slate-200" : "bg-[#0F141C] border-white/[0.08]"}`}>
        <div className="flex items-center gap-2">
          <span className={isLight ? "text-slate-500" : "text-gray-400"}>Account Trades:</span>
          <strong className={`font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
            Showing {filteredTrades.length} of {trades.length} records
          </strong>
        </div>

        <div className="flex items-center gap-2">
          {/* Fetch History Button */}
          <button
            onClick={() => setIsFetchHistoryOpen(true)}
            disabled={!selectedAccount}
            title={!selectedAccount ? "Select an MT5 account before fetching historical trades" : "Fetch historical trades for selected account"}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-sm disabled:opacity-40 disabled:pointer-events-none"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Fetch Historical Trades</span>
          </button>

          {/* Download CSV Button */}
          <button
            onClick={handleExportCSV}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
              isLight
                ? "bg-white border-slate-300 text-slate-800 hover:bg-slate-100 shadow-sm"
                : "bg-white/[0.04] border-white/[0.1] text-gray-200 hover:bg-white/[0.08]"
            }`}
            title="Export currently filtered trades to CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Filters Control Panel */}
      <div
        className={`p-5 sm:p-6 rounded-3xl border shadow-xl space-y-4 font-mono text-xs ${
          isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
        }`}
      >
        <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-white/[0.08]">
          <span className="font-bold flex items-center gap-2 font-sans">
            <Filter className="w-4 h-4 text-emerald-500" /> Filter Execution Records
          </span>

          <button
            onClick={() => {
              setSearch("");
              setSymbolFilter("ALL");
              setSideFilter("ALL");
              setStatusFilter("ALL");
              setQuickRange("ALL");
              setStartDate("");
              setEndDate("");
            }}
            className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset Filters
          </button>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="space-y-1 col-span-1 sm:col-span-2">
            <label className="block text-[11px] text-slate-500 dark:text-gray-400">Search Ticket / Symbol</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search ticket # or symbol..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-xl border outline-none text-xs transition-all ${
                  isLight
                    ? "bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900"
                    : "bg-white/[0.04] border-white/[0.1] focus:border-blue-500 text-white"
                }`}
              />
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            </div>
          </div>

          {/* Symbol */}
          <div className="space-y-1">
            <label className="block text-[11px] text-slate-500 dark:text-gray-400">Symbol</label>
            <select
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border outline-none text-xs transition-all ${
                isLight
                  ? "bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900"
                  : "bg-[#0F141C] border-white/[0.1] focus:border-blue-500 text-white"
              }`}
            >
              {uniqueSymbols.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>
          </div>

          {/* Side */}
          <div className="space-y-1">
            <label className="block text-[11px] text-slate-500 dark:text-gray-400">Side</label>
            <select
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value as "ALL" | "BUY" | "SELL")}
              className={`w-full px-3 py-2 rounded-xl border outline-none text-xs transition-all ${
                isLight
                  ? "bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900"
                  : "bg-[#0F141C] border-white/[0.1] focus:border-blue-500 text-white"
              }`}
            >
              <option value="ALL">All Sides</option>
              <option value="BUY">BUY Only</option>
              <option value="SELL">SELL Only</option>
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="block text-[11px] text-slate-500 dark:text-gray-400">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "OPEN" | "CLOSED")}
              className={`w-full px-3 py-2 rounded-xl border outline-none text-xs transition-all ${
                isLight
                  ? "bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900"
                  : "bg-[#0F141C] border-white/[0.1] focus:border-blue-500 text-white"
              }`}
            >
              <option value="ALL">All Status</option>
              <option value="OPEN">OPEN Only</option>
              <option value="CLOSED">CLOSED Only</option>
            </select>
          </div>

          {/* Quick Date Ranges */}
          <div className="space-y-1">
            <label className="block text-[11px] text-slate-500 dark:text-gray-400">Quick Range</label>
            <select
              value={quickRange}
              onChange={(e) => handleQuickRange(e.target.value as any)}
              className={`w-full px-3 py-2 rounded-xl border outline-none text-xs transition-all ${
                isLight
                  ? "bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900"
                  : "bg-[#0F141C] border-white/[0.1] focus:border-blue-500 text-white"
              }`}
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
              <option value="MONTH">This Month</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trades Table Card */}
      <div
        className={`p-5 sm:p-7 rounded-3xl border shadow-xl space-y-5 ${
          isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr
                className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                  isLight ? "border-slate-200 text-slate-500" : "border-white/[0.08] text-gray-400"
                }`}
              >
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Time</th>
                <th className="py-3 px-3">Ticket</th>
                <th className="py-3 px-3">Symbol</th>
                <th className="py-3 px-3">Side</th>
                <th className="py-3 px-3">Volume</th>
                <th className="py-3 px-3">Open Price</th>
                <th className="py-3 px-3">Close Price</th>
                <th className="py-3 px-3">SL</th>
                <th className="py-3 px-3">TP</th>
                <th className="py-3 px-3">Comm.</th>
                <th className="py-3 px-3">Swap</th>
                <th className="py-3 px-3">Profit</th>
                <th className="py-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {paginatedTrades.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400 font-sans">
                    No MT5 trades found matching current filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedTrades.map((t) => {
                  const isBuy = t.side === "BUY";
                  const isProfit = t.profit >= 0;

                  let dateStr = "";
                  let timeStr = "";
                  try {
                    const parsed = parseISO(t.openTime);
                    dateStr = format(parsed, "dd MMM yyyy");
                    timeStr = format(parsed, "HH:mm:ss");
                  } catch {
                    dateStr = t.openTime;
                  }

                  return (
                    <tr
                      key={t.ticket}
                      onClick={() => setSelectedTrade(t)}
                      className={`cursor-pointer transition-colors ${
                        isLight ? "hover:bg-slate-50" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="py-3 px-3 whitespace-nowrap text-slate-500 dark:text-gray-400">{dateStr}</td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-500 dark:text-gray-400">{timeStr}</td>
                      <td className="py-3 px-3 font-bold">{t.ticket}</td>
                      <td className="py-3 px-3 font-bold">{t.symbol}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isBuy
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {t.side}
                        </span>
                      </td>
                      <td className="py-3 px-3">{t.volume}</td>
                      <td className="py-3 px-3">{t.openPrice}</td>
                      <td className="py-3 px-3">{t.closePrice ?? "-"}</td>
                      <td className="py-3 px-3 text-rose-500">{t.stopLoss ?? "-"}</td>
                      <td className="py-3 px-3 text-emerald-500">{t.takeProfit ?? "-"}</td>
                      <td className="py-3 px-3 text-slate-500 dark:text-gray-400">${t.commission.toFixed(2)}</td>
                      <td className="py-3 px-3 text-slate-500 dark:text-gray-400">${t.swap.toFixed(2)}</td>
                      <td className="py-3 px-3 font-bold whitespace-nowrap">
                        <span className={isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {isProfit ? "+" : ""}${t.profit.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.status === "OPEN" ? "bg-amber-500/20 text-amber-600 dark:text-amber-300" : "bg-slate-500/10 text-slate-500 dark:text-gray-400"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-white/[0.08] font-mono text-xs">
          <div className="text-slate-500 dark:text-gray-400">
            Showing {filteredTrades.length > 0 ? (pageIndex - 1) * pageSize + 1 : 0}-
            {Math.min(pageIndex * pageSize, filteredTrades.length)} of {filteredTrades.length} trades
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-gray-400">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded-lg border text-xs outline-none ${
                  isLight ? "bg-slate-50 border-slate-300 text-slate-800" : "bg-[#0F141C] border-white/[0.1] text-white"
                }`}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Prev / Next Page Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={pageIndex <= 1}
                className={`p-1.5 rounded-lg border transition-colors ${
                  pageIndex <= 1
                    ? "opacity-40 cursor-not-allowed border-slate-200 dark:border-white/5"
                    : isLight
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    : "bg-white/5 hover:bg-white/10 text-gray-300"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 font-bold">{pageIndex} / {totalPages}</span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageIndex >= totalPages}
                className={`p-1.5 rounded-lg border transition-colors ${
                  pageIndex >= totalPages
                    ? "opacity-40 cursor-not-allowed border-slate-200 dark:border-white/5"
                    : isLight
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    : "bg-white/5 hover:bg-white/10 text-gray-300"
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Trade Detail Drawer */}
      <MT5TradeDetailDrawer
        trade={selectedTrade}
        account={selectedAccount}
        onClose={() => setSelectedTrade(null)}
      />

      {/* Fetch History Modal */}
      <FetchMT5HistoryModal
        open={isFetchHistoryOpen}
        onClose={() => setIsFetchHistoryOpen(false)}
      />
    </div>
  );
}
