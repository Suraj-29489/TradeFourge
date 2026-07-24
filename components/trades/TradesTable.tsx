"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
  ArrowUpDown,
  SlidersHorizontal,
  CheckCheck,
  X,
  RotateCcw,
} from "lucide-react";

type SortField = "closeTime" | "symbol" | "volume" | "profit" | "rr";
type SortOrder = "asc" | "desc";

/* ─── Column Dropdown (Portal) ─────────────────────────────────────────────── */

const COLUMN_LABELS: Record<string, string> = {
  date:       "Date",
  time:       "Time",
  ticket:     "Ticket",
  symbol:     "Symbol",
  direction:  "Direction",
  lot:        "Lot Size",
  entry:      "Entry",
  exit:       "Exit",
  pnl:        "Net PnL",
  commission: "Commission",
  swap:       "Swap",
  rr:         "R:R",
  status:     "Status",
};

const DEFAULT_COLUMNS = {
  date: true, time: false, ticket: false, symbol: true, direction: true,
  lot: true, entry: true, exit: true, pnl: true, commission: true, swap: true,
  rr: true, status: true,
};

function ColumnDropdown({
  columnVisibility,
  setColumnVisibility,
  onClose,
  anchorRect,
}: {
  columnVisibility: Record<string, boolean>;
  setColumnVisibility: (cols: Record<string, boolean>) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const style: React.CSSProperties = {
    position: "fixed",
    top: anchorRect.bottom + 8,
    right: window.innerWidth - anchorRect.right,
    zIndex: 9999,
    minWidth: 200,
  };

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="bg-dark-card border border-dark-border rounded-2xl p-3 shadow-2xl space-y-1 text-xs font-mono"
    >
      <div className="text-gray-400 font-bold uppercase pb-2 border-b border-dark-border mb-2 flex items-center justify-between">
        <span>Columns</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setColumnVisibility(Object.fromEntries(Object.keys(columnVisibility).map(k => [k, true])))}
            className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-0.5"
            title="Show all"
          >
            <CheckCheck className="w-3 h-3" />
          </button>
          <button
            onClick={() => setColumnVisibility(DEFAULT_COLUMNS)}
            className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-0.5"
            title="Reset to default"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {Object.entries(columnVisibility).map(([colKey, isVisible]) => (
        <label key={colKey} className="flex items-center gap-2.5 text-gray-300 cursor-pointer hover:text-white py-0.5 select-none">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={e => setColumnVisibility({ ...columnVisibility, [colKey]: e.target.checked })}
            className="rounded bg-dark-card border-dark-border accent-brand-500"
          />
          <span>{COLUMN_LABELS[colKey] ?? colKey}</span>
        </label>
      ))}
    </div>,
    document.body
  );
}

/* ─── Main Table ────────────────────────────────────────────────────────────── */

export const TradesTable: React.FC = () => {
  const { format: formatCurrency }   = useCurrencyFormatter();
  const deleteTrade                  = useJournalStore(s => s.deleteTrade);
  const journals                     = useJournalStore(s => s.journals);
  const filters                      = useJournalStore(s => s.filters);
  const setFilters                   = useJournalStore(s => s.setFilters);
  const columnVisibility             = useJournalStore(s => s.columnVisibility);
  const setColumnVisibility          = useJournalStore(s => s.setColumnVisibility);

  const { filteredTrades }           = useJournalMetrics();

  const [activeTrade, setActiveTrade] = useState<NormalizedTrade | null>(null);
  const [pageSize, setPageSize]       = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField]     = useState<SortField>("closeTime");
  const [sortOrder, setSortOrder]     = useState<SortOrder>("desc");
  const [showColMenu, setShowColMenu] = useState(false);
  const [colBtnRect, setColBtnRect]   = useState<DOMRect | null>(null);
  const colBtnRef                     = useRef<HTMLButtonElement>(null);

  // Sort
  const sortedTrades = React.useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      let valA: unknown = a[sortField as keyof NormalizedTrade];
      let valB: unknown = b[sortField as keyof NormalizedTrade];
      if (sortField === "closeTime") { valA = new Date(a.closeTime).getTime(); valB = new Date(b.closeTime).getTime(); }
      else if (sortField === "rr")   { valA = a.rr ?? -999; valB = b.rr ?? -999; }
      if ((valA as number) < (valB as number)) return sortOrder === "asc" ? -1 : 1;
      if ((valA as number) > (valB as number)) return sortOrder === "asc" ?  1 : -1;
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
    if (sortField === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortOrder("desc"); }
  };

  const openColMenu = () => {
    if (colBtnRef.current) setColBtnRect(colBtnRef.current.getBoundingClientRect());
    setShowColMenu(true);
  };

  const handleSetColumnVisibility = useCallback((cols: Record<string, boolean>) => {
    setColumnVisibility(cols as Partial<typeof columnVisibility>);
  }, [setColumnVisibility]);

  // Find journal for a trade (for delete)
  const findJournalId = (ticket: string): string => {
    for (const j of journals) {
      if (j.trades.some(t => t.ticket === ticket)) return j.id;
    }
    return "";
  };

  const colVis = columnVisibility as unknown as Record<string, boolean>;

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="p-3 sm:p-4 rounded-2xl glass-card border border-dark-border flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search symbol, ticket..."
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-dark-card border border-dark-border text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500 transition-colors font-mono"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={filters.direction}
            onChange={e => setFilters(prev => ({ ...prev, direction: e.target.value as never }))}
            className="px-2.5 py-2 rounded-xl bg-dark-card border border-dark-border text-xs font-mono text-gray-300 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Dir.</option>
            <option value="LONG">Long</option>
            <option value="SHORT">Short</option>
          </select>

          <select
            value={filters.status}
            onChange={e => setFilters(prev => ({ ...prev, status: e.target.value as never }))}
            className="px-2.5 py-2 rounded-xl bg-dark-card border border-dark-border text-xs font-mono text-gray-300 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Status</option>
            <option value="WIN">Win</option>
            <option value="LOSS">Loss</option>
            <option value="BREAKEVEN">Breakeven</option>
          </select>

          <select
            value={filters.dateRange}
            onChange={e => setFilters(prev => ({ ...prev, dateRange: e.target.value as never }))}
            className="px-2.5 py-2 rounded-xl bg-dark-card border border-dark-border text-xs font-mono text-gray-300 focus:outline-none focus:border-brand-500 col-span-2 sm:col-span-1"
          >
            <option value="ALL">All Time</option>
            <option value="7D">Last 7 Days</option>
            <option value="30D">Last 30 Days</option>
            <option value="90D">Last 90 Days</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="THIS_YEAR">This Year</option>
          </select>

          {/* Column Toggle — Portal-based dropdown */}
          <button
            ref={colBtnRef}
            onClick={openColMenu}
            className="p-2 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-hover text-gray-300 transition-colors flex items-center justify-center gap-1.5 text-xs font-mono hidden md:flex"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Columns</span>
          </button>

          {showColMenu && colBtnRect && (
            <ColumnDropdown
              columnVisibility={colVis}
              setColumnVisibility={handleSetColumnVisibility}
              onClose={() => setShowColMenu(false)}
              anchorRect={colBtnRect}
            />
          )}
        </div>
      </div>

      {/* Mobile Trade Cards View (<768px) */}
      <div className="space-y-3 md:hidden">
        {paginatedTrades.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-gray-400 glass-card rounded-2xl border border-dark-border">
            No trades match the current filters
          </div>
        ) : (
          paginatedTrades.map((t) => {
            const isWin = t.status === "WIN";
            const isLoss = t.status === "LOSS";
            const closeDate = parseISO(t.closeTime);

            return (
              <div
                key={`mobile-${t.journalId ?? ""}-${t.ticket}`}
                onClick={() => setActiveTrade(t)}
                className="p-4 rounded-2xl glass-card border border-dark-border hover:border-brand-500/40 cursor-pointer transition-all space-y-3"
              >
                {/* Top row: Ticket & Date */}
                <div className="flex items-center justify-between text-xs font-mono text-gray-400 border-b border-dark-border pb-2">
                  <span className="font-bold text-gray-300">Ticket: #{t.ticket}</span>
                  <span>{format(closeDate, "yyyy-MM-dd HH:mm")}</span>
                </div>

                {/* Main row: Symbol, Direction, PnL, RR */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold font-mono text-white">{t.symbol}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                        t.direction === "LONG"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-500 border border-rose-500/30"
                      }`}
                    >
                      {t.direction === "LONG" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {t.direction}
                    </span>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-base font-bold font-mono block ${
                        isWin ? "text-emerald-500" : isLoss ? "text-rose-500" : "text-gray-400"
                      }`}
                    >
                      {t.profit >= 0 ? "+" : ""}
                      {formatCurrency(t.profit)}
                    </span>
                    <span className="text-[10px] font-mono text-brand-400">
                      {t.rr !== null ? `${t.rr} R` : "R:R N/A"}
                    </span>
                  </div>
                </div>

                {/* Secondary stats: Entry, Exit, Lot, Status */}
                <div className="grid grid-cols-4 gap-2 pt-1 text-[11px] font-mono text-gray-400 border-t border-dark-border">
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase">Lot</span>
                    <span className="font-bold text-gray-200">{t.volume}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase">Entry</span>
                    <span className="font-bold text-gray-200">{t.openPrice ?? "-"}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase">Exit</span>
                    <span className="font-bold text-gray-200">{t.closePrice}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[9px] text-gray-500 uppercase">Status</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        isWin
                          ? "bg-emerald-500/10 text-emerald-500"
                          : isLoss
                          ? "bg-rose-500/10 text-rose-500"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Main Table (Desktop & Tablet >=768px) */}
      <div className="rounded-2xl glass-card border border-dark-border overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-dark-card text-gray-400 border-b border-dark-border sticky top-0 z-10">
              <tr>
                {colVis.date      && <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("closeTime")}><div className="flex items-center gap-1"><span>Date</span><ArrowUpDown className="w-3 h-3 text-gray-500" /></div></th>}
                {colVis.time      && <th className="py-3 px-4">Time</th>}
                {colVis.ticket    && <th className="py-3 px-4">Ticket</th>}
                {colVis.symbol    && <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("symbol")}><div className="flex items-center gap-1"><span>Symbol</span><ArrowUpDown className="w-3 h-3 text-gray-500" /></div></th>}
                {colVis.direction && <th className="py-3 px-4">Direction</th>}
                {colVis.lot       && <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("volume")}><div className="flex items-center gap-1"><span>Lot</span><ArrowUpDown className="w-3 h-3 text-gray-500" /></div></th>}
                {colVis.entry     && <th className="py-3 px-4">Entry</th>}
                {colVis.exit      && <th className="py-3 px-4">Exit</th>}
                {colVis.pnl       && <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("profit")}><div className="flex items-center gap-1"><span>Net PnL</span><ArrowUpDown className="w-3 h-3 text-gray-500" /></div></th>}
                {colVis.commission && <th className="py-3 px-4">Comm.</th>}
                {colVis.swap      && <th className="py-3 px-4">Swap</th>}
                {colVis.rr        && <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("rr")}><div className="flex items-center gap-1"><span>R:R</span><ArrowUpDown className="w-3 h-3 text-gray-500" /></div></th>}
                {colVis.status    && <th className="py-3 px-4">Status</th>}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border text-gray-300">
              {paginatedTrades.length === 0 && (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-gray-400 text-xs font-mono">
                    No trades match the current filters
                  </td>
                </tr>
              )}
              {paginatedTrades.map(t => {
                const isWin  = t.status === "WIN";
                const isLoss = t.status === "LOSS";
                const closeDate = parseISO(t.closeTime);

                return (
                  <tr key={`${t.journalId ?? ""}-${t.ticket}`} className="hover:bg-dark-hover/40 transition-colors">
                    {colVis.date      && <td className="py-3 px-4 text-gray-400">{format(closeDate, "yyyy-MM-dd")}</td>}
                    {colVis.time      && <td className="py-3 px-4 text-gray-400">{format(closeDate, "HH:mm")}</td>}
                    {colVis.ticket    && <td className="py-3 px-4 text-gray-400">{t.ticket}</td>}
                    {colVis.symbol    && <td className="py-3 px-4 font-bold text-white">{t.symbol}</td>}
                    {colVis.direction && (
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit ${t.direction === "LONG" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30" : "bg-rose-500/10 text-rose-500 border border-rose-500/30"}`}>
                          {t.direction === "LONG" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {t.direction}
                        </span>
                      </td>
                    )}
                    {colVis.lot       && <td className="py-3 px-4">{t.volume}</td>}
                    {colVis.entry     && <td className="py-3 px-4">{t.openPrice !== null ? t.openPrice : "-"}</td>}
                    {colVis.exit      && <td className="py-3 px-4">{t.closePrice}</td>}
                    {colVis.pnl       && <td className={`py-3 px-4 font-bold ${isWin ? "text-emerald-500" : isLoss ? "text-rose-500" : "text-gray-300"}`}>{t.profit >= 0 ? "+" : ""}{formatCurrency(t.profit)}</td>}
                    {colVis.commission && <td className="py-3 px-4 text-gray-400">{formatCurrency(t.commission)}</td>}
                    {colVis.swap      && <td className="py-3 px-4 text-gray-400">{formatCurrency(t.swap)}</td>}
                    {colVis.rr        && <td className="py-3 px-4 text-brand-400">{t.rr !== null ? `${t.rr}R` : "N/A"}</td>}
                    {colVis.status    && (
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isWin ? "bg-emerald-500/10 text-emerald-500" : isLoss ? "bg-rose-500/10 text-rose-500" : "bg-gray-500/10 text-gray-400"}`}>
                          {t.status}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setActiveTrade(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-card transition-colors" title="View details">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete position ${t.ticket}?`)) {
                              const jid = t.journalId ?? findJournalId(t.ticket);
                              deleteTrade(jid, t.ticket);
                            }
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-dark-card transition-colors"
                          title="Delete position"
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

        {/* Pagination */}
        <div className="p-4 border-t border-dark-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-gray-400">
          <div>
            {sortedTrades.length === 0
              ? "No positions"
              : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sortedTrades.length)} of ${sortedTrades.length}`}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="px-2 py-1 rounded-lg bg-dark-card border border-dark-border text-gray-300 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border disabled:opacity-40 hover:bg-dark-hover transition-colors">Prev</button>
              <span className="px-2 font-bold text-white">{currentPage}/{totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border disabled:opacity-40 hover:bg-dark-hover transition-colors">Next</button>
            </div>
          </div>
        </div>
      </div>

      <TradeDetailDrawer trade={activeTrade as never} onClose={() => setActiveTrade(null)} />
    </div>
  );
};
