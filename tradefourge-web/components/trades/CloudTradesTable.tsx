"use client";
// components/trades/CloudTradesTable.tsx
// Advanced Cloud-backed Trade Explorer Table with Bulk Selection, Column Toggles, 
// Indicator Badges, and Rich Filters.

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import {
  Search, TrendingUp, TrendingDown, Eye, Trash2, SlidersHorizontal,
  CheckCheck, X, RotateCcw, FileText, Camera, Tag as TagIcon, Download, Check
} from "lucide-react";
import { useJournalStore, ColumnVisibility, DEFAULT_COLUMN_VISIBILITY } from "@/lib/store/useJournalStore";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { OutcomeBadge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import { MultiAccountFilter } from "@/components/accounts/MultiAccountFilter";
import type { CloudTradeWithRelations, CloudTradeFilters, PaginatedResult, TradingAccount } from "@/types/database";

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
            className="text-blue-400 hover:text-blue-300"
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
            className="rounded accent-blue-600"
          />
          {COLUMN_LABELS[key]}
        </label>
      ))}
    </div>,
    document.body
  );
}

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
  accounts: TradingAccount[];
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
  const [colBtnRect, setColBtnRect] = useState<DOMRect | null>(null);
  const colBtnRef = useRef<HTMLButtonElement>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const openColMenu = () => {
    if (colBtnRef.current) setColBtnRect(colBtnRef.current.getBoundingClientRect());
    setShowColMenu(true);
  };

  const trades = result?.data ?? [];
  const cv = columnVisibility;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(trades.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Delete ${selectedIds.length} selected trades permanently?`)) {
      for (const id of selectedIds) {
        await onDeleteTrade(id);
      }
      setSelectedIds([]);
    }
  };

  const handleBulkExport = () => {
    if (selectedIds.length === 0) return;
    const selectedTrades = trades.filter((t) => selectedIds.includes(t.id));
    const headers = ["Ticket", "Symbol", "Side", "Volume", "Open Time", "Close Time", "Open Price", "Close Price", "Net PnL", "RR", "Session"];
    const rows = selectedTrades.map((t) => [
      t.ticket || t.id.slice(0, 8),
      t.symbol,
      t.side,
      t.volume,
      t.open_time,
      t.close_time,
      t.open_price,
      t.close_price,
      t.net_profit,
      t.rr_ratio || 0,
      t.session || "N/A",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tradefourge_bulk_export_${selectedIds.length}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      <div className="p-3 sm:p-4 rounded-2xl bg-[#111726] border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xl">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search symbol, ticket, notes..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Side */}
          <select
            value={filters.side}
            onChange={(e) => onFiltersChange({ side: e.target.value as CloudTradeFilters["side"] })}
            className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-gray-300 focus:outline-none focus:border-blue-500"
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
            className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-gray-300 focus:outline-none focus:border-blue-500"
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
            className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-gray-300 focus:outline-none focus:border-blue-500"
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
            <MultiAccountFilter
              accounts={accounts}
              selectedAccountIds={filters.accountIds || (filters.accountId !== 'ALL' ? [filters.accountId] : ['ALL'])}
              onChange={(ids) => {
                onFiltersChange({
                  accountIds: ids,
                  accountId: ids.length === 1 ? ids[0] : 'ALL',
                });
              }}
            />
          )}

          {/* Columns Button */}
          <button
            ref={colBtnRef}
            onClick={openColMenu}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-gray-300 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
            <span>Columns</span>
          </button>
        </div>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 rounded-2xl bg-blue-900/30 border border-blue-500/40 flex items-center justify-between gap-3 text-xs font-mono shadow-2xl">
          <div className="flex items-center gap-2 text-blue-300 font-bold">
            <CheckCheck className="w-4 h-4 text-blue-400" />
            <span>{selectedIds.length} trade(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkExport}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Export Selected
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Bulk Delete
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 text-gray-300 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Column Dropdown Portal */}
      {showColMenu && colBtnRect && (
        <ColumnDropdown
          visibility={columnVisibility}
          onChange={(cols) => setColumnVisibility(cols)}
          onClose={() => setShowColMenu(false)}
          anchorRect={colBtnRect}
        />
      )}

      {/* Main Table */}
      {loading ? (
        <TableSkeleton rows={10} cols={8} />
      ) : (
        <div className="rounded-2xl bg-[#111726] border border-white/10 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 uppercase text-[10px] bg-white/5">
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={trades.length > 0 && selectedIds.length === trades.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded accent-blue-600"
                    />
                  </th>
                  {cv.date       && <th className="py-3 px-3">Date</th>}
                  {cv.ticket     && <th className="py-3 px-3">Ticket</th>}
                  {cv.symbol     && <th className="py-3 px-3">Symbol</th>}
                  {cv.side       && <th className="py-3 px-3">Side</th>}
                  {cv.volume     && <th className="py-3 px-3">Lots</th>}
                  {cv.open_price && <th className="py-3 px-3">Entry</th>}
                  {cv.close_price&& <th className="py-3 px-3">Exit</th>}
                  {cv.net_profit && <th className="py-3 px-3">Net PnL</th>}
                  {cv.commission && <th className="py-3 px-3">Comm.</th>}
                  {cv.swap       && <th className="py-3 px-3">Swap</th>}
                  {cv.rr_ratio   && <th className="py-3 px-3">R:R</th>}
                  {cv.outcome    && <th className="py-3 px-3">Outcome</th>}
                  {cv.duration   && <th className="py-3 px-3">Duration</th>}
                  {cv.account    && <th className="py-3 px-3">Account</th>}
                  <th className="py-3 px-3">Indicators</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {trades.map((t) => {
                  const isBuy = t.side === "BUY" || t.side === "LONG";
                  const dateStr = t.close_time || t.open_time || t.created_at;
                  const formattedDate = dateStr ? format(parseISO(dateStr), "yyyy-MM-dd HH:mm") : "—";
                  const isSelected = selectedIds.includes(t.id);
                  const hasNotes = !!(t.notes || t.emotions || t.lessons);
                  const hasImages = (t.images || []).length > 0;
                  const hasTags = (t.tags || []).length > 0;

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-white/5 transition-colors group ${isSelected ? "bg-blue-600/10" : ""}`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectOne(t.id, e.target.checked)}
                          className="rounded accent-blue-600"
                        />
                      </td>

                      {cv.date && (
                        <td className="py-3 px-3 text-gray-300 whitespace-nowrap">
                          {formattedDate}
                        </td>
                      )}

                      {cv.ticket && (
                        <td className="py-3 px-3 text-gray-400 font-mono text-[11px]">
                          #{t.ticket || t.id.slice(0, 8)}
                        </td>
                      )}

                      {cv.symbol && (
                        <td className="py-3 px-3">
                          <button
                            onClick={() => onFiltersChange({ search: t.symbol })}
                            className="font-extrabold text-white hover:text-blue-400 transition-colors"
                          >
                            {t.symbol}
                          </button>
                        </td>
                      )}

                      {cv.side && (
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-flex items-center gap-1 ${
                              isBuy
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {t.side}
                          </span>
                        </td>
                      )}

                      {cv.volume && (
                        <td className="py-3 px-3 text-gray-300 font-mono">
                          {t.volume}
                        </td>
                      )}

                      {cv.open_price && (
                        <td className="py-3 px-3 text-gray-300 font-mono">
                          {t.open_price ?? "—"}
                        </td>
                      )}

                      {cv.close_price && (
                        <td className="py-3 px-3 text-gray-300 font-mono">
                          {t.close_price ?? "—"}
                        </td>
                      )}

                      {cv.net_profit && (
                        <td className="py-3 px-3 font-mono font-extrabold">
                          <span className={t.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            {t.net_profit >= 0 ? "+" : ""}
                            {fmtCurrency(t.net_profit)}
                          </span>
                        </td>
                      )}

                      {cv.commission && (
                        <td className="py-3 px-3 text-gray-400 font-mono">
                          {t.commission ? fmtCurrency(t.commission) : "—"}
                        </td>
                      )}

                      {cv.swap && (
                        <td className="py-3 px-3 text-gray-400 font-mono">
                          {t.swap ? fmtCurrency(t.swap) : "—"}
                        </td>
                      )}

                      {cv.rr_ratio && (
                        <td className="py-3 px-3 font-mono text-blue-400 font-bold">
                          {t.rr_ratio !== null ? `${t.rr_ratio}R` : "—"}
                        </td>
                      )}

                      {cv.outcome && (
                        <td className="py-3 px-3">
                          <OutcomeBadge outcome={t.outcome} />
                        </td>
                      )}

                      {cv.duration && (
                        <td className="py-3 px-3 text-gray-400 font-mono whitespace-nowrap">
                          {formatDuration(t.duration_seconds)}
                        </td>
                      )}

                      {cv.account && (
                        <td className="py-3 px-3 text-gray-400 truncate max-w-[100px]">
                          {t.account?.account_name ?? "Default"}
                        </td>
                      )}

                      {/* Indicators Column */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          {hasNotes && (
                            <span className="p-1 rounded bg-blue-500/20 text-blue-300" title="Has journal notes">
                              <FileText className="w-3 h-3" />
                            </span>
                          )}
                          {hasImages && (
                            <span className="p-1 rounded bg-emerald-500/20 text-emerald-300" title="Has chart images">
                              <Camera className="w-3 h-3" />
                            </span>
                          )}
                          {hasTags && (
                            <span className="p-1 rounded bg-indigo-500/20 text-indigo-300" title="Has custom tags">
                              <TagIcon className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onViewTrade(t)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Inspect Trade"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteTrade(t.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete trade"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
          {result && (
            <div className="p-4 border-t border-white/10">
              <Pagination
                page={result.page}
                pageSize={result.pageSize}
                total={result.total}
                totalPages={result.totalPages}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
