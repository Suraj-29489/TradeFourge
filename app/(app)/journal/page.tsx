"use client";
// app/(app)/journal/page.tsx
// Cloud-backed Trade Journal — replaces the previous Zustand/IndexedDB version.
// All trade data comes exclusively from Supabase.

import React, { useEffect, useState, useCallback } from "react";
import { TableProperties, Upload, Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades, deleteTrade } from "@/lib/supabase/trades";
import { useAppEventListener } from "@/lib/events/event-bus";
import { fetchTradingAccounts } from "@/lib/supabase/accounts";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { CloudTradesTable } from "@/components/trades/CloudTradesTable";
import { CloudTradeDetailDrawer } from "@/components/trades/CloudTradeDetailDrawer";
import { AddTradeModal } from "@/components/trades/AddTradeModal";
import { EmptyState } from "@/components/ui/EmptyState";
import type {
  CloudTradeWithRelations,
  CloudTradeFilters,
  PaginatedResult,
  TradingAccount,
} from "@/types/database";

export default function JournalPage() {
  const [userId, setUserId]           = useState<string | null>(null);
  const [result, setResult]           = useState<PaginatedResult<CloudTradeWithRelations> | null>(null);
  const [accounts, setAccounts]       = useState<TradingAccount[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTrade, setActiveTrade] = useState<CloudTradeWithRelations | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

  const handleFiltersChange = (partial: Partial<CloudTradeFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setPage(1);
  };

  useAppEventListener(
    ["tradefourge:trade-created", "tradefourge:trade-updated", "tradefourge:trade-deleted", "tradefourge:import-created", "tradefourge:import-deleted"],
    loadTrades
  );

  const handleDeleteTrade = async (id: string) => {
    if (!userId) return;
    const { data: success, error: delErr } = await deleteTrade(id, userId);
    if (success) {
      if (result?.data) {
        setResult({
          ...result,
          data: result.data.filter((t) => t.id !== id),
          total: Math.max(0, result.total - 1),
        });
      }
    } else {
      console.error("[TradeFourge Dev Log] Delete trade failed:", delErr);
    }
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
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm font-mono shadow-glow transition-all active:scale-95"
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

      {/* Manual Trade Entry Modal */}
      <AddTradeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadTrades}
      />

      {/* Cloud Trade Detail Drawer */}
      <CloudTradeDetailDrawer
        trade={activeTrade}
        onClose={() => setActiveTrade(null)}
        onRefresh={loadTrades}
      />
    </div>
  );
}
