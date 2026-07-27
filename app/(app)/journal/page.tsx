"use client";
// app/(app)/journal/page.tsx
// Cloud-backed Trade Journal — replaces the previous Zustand/IndexedDB version.
// All trade data comes exclusively from Supabase.

import React, { useEffect, useState, useCallback } from "react";
import { TableProperties, Upload, Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades, deleteTrade } from "@/lib/supabase/trades";
import { fetchTradingAccounts } from "@/lib/supabase/accounts";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { CloudTradesTable } from "@/components/trades/CloudTradesTable";
import { EmptyState } from "@/components/ui/EmptyState";
import type {
  CloudTradeWithRelations,
  CloudTradeFilters,
  PaginatedResult,
  TradingAccount,
} from "@/types/database";
import { DEFAULT_CLOUD_FILTERS } from "@/types/database";

export default function JournalPage() {
  const [userId, setUserId]         = useState<string | null>(null);
  const [result, setResult]         = useState<PaginatedResult<CloudTradeWithRelations> | null>(null);
  const [accounts, setAccounts]     = useState<TradingAccount[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTrade, setActiveTrade] = useState<CloudTradeWithRelations | null>(null);

  // Filters live in Zustand (ephemeral UI state only)
  const filters = useJournalStore((s) => s.filters);
  const setFilters = useJournalStore((s) => s.setFilters);

  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const supabase = createClient();

  // ── Load user & accounts once ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data } = await fetchTradingAccounts(user.id);
        if (data) setAccounts(data);
      }
    })();
  }, []);

  // ── Load trades whenever deps change ─────────────────────────────────────
  const loadTrades = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await fetchTrades(userId, filters, page, pageSize, "close_time", false);
    setResult(data);
    setLoading(false);
  }, [userId, filters, page, pageSize]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFiltersChange = (partial: Partial<CloudTradeFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setPage(1); // Reset to page 1 on filter change
  };

  const handleDeleteTrade = async (id: string) => {
    if (!userId) return;
    await deleteTrade(id, userId);
    loadTrades();
  };

  // No trades AND no filters applied → true empty state
  const isCompletelyEmpty =
    !loading &&
    result !== null &&
    result.total === 0 &&
    filters.search === "" &&
    filters.side === "ALL" &&
    filters.outcome === "ALL" &&
    filters.dateRange === "ALL" &&
    filters.accountId === "ALL";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#111726] to-[#182238] border border-white/10 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
            <TableProperties className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2 font-mono">
              Trade Journal
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
                CLOUD
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {result
                ? `${result.total.toLocaleString()} trade${result.total !== 1 ? "s" : ""} in cloud · Supabase`
                : "Loading from cloud..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 font-bold text-sm font-mono transition-all"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Link>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600/30 border border-purple-500/30 text-purple-300 font-bold text-sm font-mono opacity-60 cursor-not-allowed"
            title="Manual trade entry — coming in Phase 3.1"
          >
            <Plus className="w-4 h-4" />
            Add Trade
          </button>
        </div>
      </div>

      {/* Empty State */}
      {isCompletelyEmpty ? (
        <EmptyState
          icon={TableProperties}
          title="No Trades Yet"
          description="Your cloud journal is empty. Import a CSV from your broker to populate your trade history, or add trades manually."
          action={{
            label: "Import CSV",
            href: "/upload",
          }}
          secondaryAction={{
            label: "View Accounts",
            href: "/accounts",
          }}
        />
      ) : (
        <CloudTradesTable
          result={result}
          loading={loading}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          onDeleteTrade={handleDeleteTrade}
          onViewTrade={setActiveTrade}
          onRefresh={loadTrades}
          accounts={accounts.map((a) => ({ id: a.id, account_name: a.account_name }))}
        />
      )}

      {/* Trade Detail Drawer — Phase 3.1 will build the cloud version */}
      {activeTrade && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-end"
          onClick={() => setActiveTrade(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full md:w-[480px] h-[90vh] md:h-full bg-[#111726] border-l border-white/10 shadow-2xl overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white font-mono">
                Trade Details
              </h2>
              <button
                onClick={() => setActiveTrade(null)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            {/* Core fields */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              {[
                { label: "Symbol",     value: activeTrade.symbol },
                { label: "Side",       value: activeTrade.side },
                { label: "Volume",     value: activeTrade.volume },
                { label: "Outcome",    value: activeTrade.outcome ?? "—" },
                { label: "Entry",      value: activeTrade.open_price ?? "—" },
                { label: "Exit",       value: activeTrade.close_price ?? "—" },
                { label: "Net PnL",    value: `${activeTrade.net_profit >= 0 ? "+" : ""}${activeTrade.net_profit.toFixed(2)}` },
                { label: "R:R",        value: activeTrade.rr_ratio !== null ? `${activeTrade.rr_ratio}R` : "—" },
                { label: "Commission", value: activeTrade.commission.toFixed(2) },
                { label: "Swap",       value: activeTrade.swap.toFixed(2) },
                { label: "Ticket",     value: activeTrade.ticket ?? "—" },
                { label: "Source",     value: activeTrade.source },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-xl bg-dark-card border border-dark-border">
                  <p className="text-gray-500 mb-1">{label}</p>
                  <p className="text-white font-bold">{String(value)}</p>
                </div>
              ))}
            </div>

            {/* Journal fields */}
            {(activeTrade.notes || activeTrade.strategy || activeTrade.emotions || activeTrade.lessons) && (
              <div className="space-y-3 border-t border-white/10 pt-4">
                {activeTrade.strategy && (
                  <div>
                    <p className="text-xs text-gray-500 font-mono mb-1">Strategy</p>
                    <p className="text-sm text-gray-200">{activeTrade.strategy}</p>
                  </div>
                )}
                {activeTrade.notes && (
                  <div>
                    <p className="text-xs text-gray-500 font-mono mb-1">Notes</p>
                    <p className="text-sm text-gray-200">{activeTrade.notes}</p>
                  </div>
                )}
                {activeTrade.emotions && (
                  <div>
                    <p className="text-xs text-gray-500 font-mono mb-1">Emotions</p>
                    <p className="text-sm text-gray-200">{activeTrade.emotions}</p>
                  </div>
                )}
                {activeTrade.lessons && (
                  <div>
                    <p className="text-xs text-gray-500 font-mono mb-1">Lessons</p>
                    <p className="text-sm text-gray-200">{activeTrade.lessons}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {activeTrade.tags && activeTrade.tags.length > 0 && (
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs text-gray-500 font-mono mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {activeTrade.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2 py-0.5 rounded text-xs font-mono font-bold border"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                        borderColor: `${tag.color}40`,
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
