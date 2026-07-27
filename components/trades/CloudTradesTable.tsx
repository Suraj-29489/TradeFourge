"use client";
// components/trades/CloudTradesTable.tsx
// Cloud-backed trades table that reads from Supabase.
// Replaces the old Zustand/IndexedDB-coupled TradesTable for the /journal route.

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Eye,
  Trash2,
  SlidersHorizontal,
  ArrowUpDown,
  RotateCcw,
  CheckCheck,
  X,
  RefreshCw,
} from "lucide-react";
import { useJournalStore, ColumnVisibility, DEFAULT_COLUMN_VISIBILITY } from "@/lib/store/useJournalStore";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { OutcomeBadge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import type { CloudTradeWithRelations, CloudTradeFilters, PaginatedResult } from "@/types/database";

// ─── Column config ─────────────────────────────────────────────────────────────

const COLUMN_LABELS: Record<keyof ColumnVisibility, string> = {
  date:       "Date",
  time:       "Time",
  ticket:     "Ticket",
  symbol:     "Symbol",
  side:       "Side",
  volume:     "Lot Size",
  open_price: "Entry",
  close_price:"Exit",
  net_profit: "Net PnL",
  commission: "Commission",
  swap:       "Swap",
  rr_ratio:   "R:R",
  outcome:    "Outcome",
  duration:   "Duration",
  account:    "Account",
};

// ─── Column Dropdown ─────────────────────────────────────────────────────────

function ColumnDropdown({
  visibility,
  onChange,
  onClose,
  anchorRect,
}: {
  visibility: ColumnVisibility;
  onChange: (cols: Partial<ColumnVisibility>) => void;
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
            onClick={() => onChange(Object.fromEntries(Object.keys(visibility).map((k) => [k, true])) as Partial<ColumnVisibility>)}
            className="text-brand-400 hover:text-brand-300"
            title="Show all"
          >
            <CheckCheck className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChange(DEFAULT_COLUMN_VISIBILITY)}
            className="text-gray-500 hover:text-gray-300"
            title="Reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {(Object.keys(visibility) as (keyof ColumnVisibility)[]).map((key) => (
        <label
          key={key}
          className="flex items-center gap-2.5 text-gray-300 cursor-pointer hover:text-white py-0.5 select-none"
        >
          <input
            type="checkbox"
            checked={visibility[key]}
            onChange={(e) => onChange({ [key]: e.target.checked } as Partial<ColumnVisibility>)}
            className="rounded accent-brand-500"
          />
          {COLUMN_LABELS[key]}
        </label>
      ))}
    </div>,
    document.body
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────

interface CloudTradesTableProps {
  result: PaginatedResult<CloudTradeWithRelations> | null;
  loading: boolean;
  filters: CloudTradeFilters;
  onFiltersChange: (f: Partial<CloudTradeFilters>) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onDeleteTrade: (id: string) => void;
  onViewTrade: (trade: CloudTradeWithRelations) => void;
  onRefresh: () => void;
  accounts: { id: string; account_name: string }[];
}

export function CloudTradesTable({
  result,
  loading,
  filters,
  onFiltersChange,
  onPageChange,
  onPageSizeChange,
  onDeleteTrade,
  onViewTrade,
  onRefresh,
  accounts,
}: CloudTradesTableProps) {
  const { format: fmtCurrency } = useCurrencyFormatter();
  const columnVisibility = useJournalStore((s) => s.columnVisibility);
  const setColumnVisibility = useJournalStore((s) => s.setColumnVisibility);

  const [showColMenu, setShowColMenu] = useState(false);
  const [colBtnRect, setColBtnRect]   = useState<DOMRect | null>(null);
  const colBtnRef = useRef<HTMLButtonElement>(null);

  const openColMenu = () => {
    if (colBtnRef.current) setColBtnRect(colBtnRef.current.getBoundingClientRect());
    setShowColMenu(true);
  };

  const trades = result?.data ?? [];
  const cv = columnVisibility;

  const formatDuration = (secs: number | null): string => {
    if (!secs) return "—";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="p-3 sm:p-4 rounded-2xl glass-card border border-dark-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search symbol, ticket, notes..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-dark-card border border-dark-border text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500 transition-colors font-mono"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Side */}
          <select
            value={filters.side}
            onChange={(e) => onFiltersChange({ side: e.target.value as CloudTradeFilters["side"] })}
            className="px-2.5 py-2 rounded-xl bg-dark-card border border-dark-border text-xs font-mono text-gray-300 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Sides</option>
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
            <option value="LONG">Long</option>
            <option value="SHORT">Short</option>
          </select>

          {/* Outcome */}
          <select
            value={filters.outcome}
            onChange={(e) => onFiltersChange({ outcome: e.target.value as CloudTradeFilters["outcome"] })}
            className="px-2.5 py-2 rounded-xl bg-dark-card border border-dark-border text-xs font-mono text-gray-300 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Outcomes</option>
            <option value="WIN">Win</option>
            <option value="LOSS">Loss</option>
            <option value="BREAKEVEN">Breakeven</option>
            <option value="OPEN">Open</option>
          </select>

          {/* Date Range */}
          <select
            value={filters.dateRange}
            onChange={(e) => onFiltersChange({ dateRange: e.target.value as CloudTradeFilters["dateRange"] })}
            className="px-2.5 py-2 rounded-xl bg-dark-card border border-dark-border text-xs font-mono text-gray-300 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Time</option>
            <option value="7D">Last 7 Days</option>
            <option value="30D">Last 30 Days</option>
            <option value="90D">Last 90 Days</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="THIS_YEAR">This Year</option>
          </select>

          {/* Account filter */}
          {accounts.length > 0 && (
            <select
              value={filters.accountId}
              onChange={(e) => onFiltersChange({ accountId: e.target.value })}
              className="px-2.5 py-2 rounded-xl bg-dark-card border border-dark-border text-xs font-mono text-gray-300 focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name}</option>
              ))}
            </select>
          )}

          {/* Column toggle */}
          <button
            ref={colBtnRef}
            onClick={openColMenu}
            className="hidden md:flex p-2 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-hover text-gray-300 items-center gap-1.5 text-xs font-mono transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Columns
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-hover text-gray-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {showColMenu && colBtnRect && (
          <ColumnDropdown
            visibility={cv}
            onChange={setColumnVisibility}
            onClose={() => setShowColMenu(false)}
            anchorRect={colBtnRect}
          />
        )}
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : trades.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-gray-400 glass-card rounded-2xl border border-dark-border">
            No trades match the current filters
          </div>
        ) : (
          trades.map((t) => {
            const isWin = t.outcome === "WIN";
            const isLoss = t.outcome === "LOSS";
            const closeDate = t.close_time ? parseISO(t.close_time) : null;

            return (
              <div
                key={t.id}
                onClick={() => onViewTrade(t)}
                className="p-4 rounded-2xl glass-card border border-dark-border hover:border-brand-500/40 cursor-pointer transition-all space-y-3"
              >
                <div className="flex items-center justify-between text-xs font-mono text-gray-400 border-b border-dark-border pb-2">
                  <span className="font-bold text-gray-300">{t.symbol}</span>
                  <span>{closeDate ? format(closeDate, "yyyy-MM-dd HH:mm") : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border font-mono ${
                        t.side === "BUY" || t.side === "LONG"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-500 border-rose-500/30"
                      }`}
                    >
                      {t.side === "BUY" || t.side === "LONG" ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {t.side}
                    </span>
                    {t.ticket && (
                      <span className="text-[10px] text-gray-500 font-mono">#{t.ticket}</span>
                    )}
                  </div>
                  <span
                    className={`text-base font-bold font-mono ${
                      isWin ? "text-emerald-500" : isLoss ? "text-rose-500" : "text-gray-400"
                    }`}
                  >
                    {t.net_profit >= 0 ? "+" : ""}
                    {fmtCurrency(t.net_profit)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table */}
      <div className="rounded-2xl glass-card border border-dark-border overflow-hidden hidden md:block">
        {loading ? (
          <TableSkeleton rows={10} cols={7} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-dark-card text-gray-400 border-b border-dark-border sticky top-0 z-10">
                <tr>
                  {cv.date       && <th className="py-3 px-4"><div className="flex items-center gap-1"><span>Date</span><ArrowUpDown className="w-3 h-3 text-gray-500" /></div></th>}
                  {cv.time       && <th className="py-3 px-4">Time</th>}
                  {cv.ticket     && <th className="py-3 px-4">Ticket</th>}
                  {cv.symbol     && <th className="py-3 px-4"><div className="flex items-center gap-1"><span>Symbol</span><ArrowUpDown className="w-3 h-3 text-gray-500" /></div></th>}
                  {cv.side       && <th className="py-3 px-4">Side</th>}
                  {cv.volume     && <th className="py-3 px-4">Lot</th>}
                  {cv.open_price && <th className="py-3 px-4">Entry</th>}
                  {cv.close_price&& <th className="py-3 px-4">Exit</th>}
                  {cv.net_profit && <th className="py-3 px-4"><div className="flex items-center gap-1"><span>Net PnL</span><ArrowUpDown className="w-3 h-3 text-gray-500" /></div></th>}
                  {cv.commission && <th className="py-3 px-4">Comm.</th>}
                  {cv.swap       && <th className="py-3 px-4">Swap</th>}
                  {cv.rr_ratio   && <th className="py-3 px-4">R:R</th>}
                  {cv.outcome    && <th className="py-3 px-4">Outcome</th>}
                  {cv.duration   && <th className="py-3 px-4">Duration</th>}
                  {cv.account    && <th className="py-3 px-4">Account</th>}
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border text-gray-300">
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="py-12 text-center text-gray-400 text-xs font-mono">
                      No trades match the current filters
                    </td>
                  </tr>
                ) : (
                  trades.map((t) => {
                    const isWin  = t.outcome === "WIN";
                    const isLoss = t.outcome === "LOSS";
                    const closeDate = t.close_time ? parseISO(t.close_time) : null;
                    const isBuy = t.side === "BUY" || t.side === "LONG";

                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-dark-hover/40 transition-colors cursor-pointer"
                        onClick={() => onViewTrade(t)}
                      >
                        {cv.date        && <td className="py-3 px-4 text-gray-400">{closeDate ? format(closeDate, "yyyy-MM-dd") : "—"}</td>}
                        {cv.time        && <td className="py-3 px-4 text-gray-400">{closeDate ? format(closeDate, "HH:mm") : "—"}</td>}
                        {cv.ticket      && <td className="py-3 px-4 text-gray-500">{t.ticket ?? "—"}</td>}
                        {cv.symbol      && <td className="py-3 px-4 font-bold text-white">{t.symbol}</td>}
                        {cv.side        && (
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit border ${
                                isBuy
                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                  : "bg-rose-500/10 text-rose-500 border-rose-500/30"
                              }`}
                            >
                              {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {t.side}
                            </span>
                          </td>
                        )}
                        {cv.volume      && <td className="py-3 px-4">{t.volume}</td>}
                        {cv.open_price  && <td className="py-3 px-4">{t.open_price ?? "—"}</td>}
                        {cv.close_price && <td className="py-3 px-4">{t.close_price ?? "—"}</td>}
                        {cv.net_profit  && (
                          <td className={`py-3 px-4 font-bold ${isWin ? "text-emerald-500" : isLoss ? "text-rose-500" : "text-gray-300"}`}>
                            {t.net_profit >= 0 ? "+" : ""}
                            {fmtCurrency(t.net_profit)}
                          </td>
                        )}
                        {cv.commission  && <td className="py-3 px-4 text-gray-400">{fmtCurrency(t.commission)}</td>}
                        {cv.swap        && <td className="py-3 px-4 text-gray-400">{fmtCurrency(t.swap)}</td>}
                        {cv.rr_ratio    && <td className="py-3 px-4 text-brand-400">{t.rr_ratio !== null ? `${t.rr_ratio}R` : "—"}</td>}
                        {cv.outcome     && <td className="py-3 px-4"><OutcomeBadge outcome={t.outcome ?? null} /></td>}
                        {cv.duration    && <td className="py-3 px-4 text-gray-400">{formatDuration(t.duration_seconds)}</td>}
                        {cv.account     && <td className="py-3 px-4 text-gray-400">{t.account?.account_name ?? "—"}</td>}
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onViewTrade(t)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-card transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete trade ${t.ticket ?? t.id}?`)) {
                                  onDeleteTrade(t.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-dark-card transition-colors"
                              title="Delete trade"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {result && (
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        )}
      </div>
    </div>
  );
}
