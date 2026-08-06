"use client";
// app/(app)/journal/page.tsx
// Institutional Trade Journal Workstation

import React, { useEffect, useState, useCallback } from "react";
import { TableProperties, Upload, Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TradeService } from "@/lib/services/TradeService";
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

import { useActiveAccount } from "@/context/ActiveAccountContext";
import { CompanionJournalView } from "@/components/companion/CompanionJournalView";
import { TradingJournalManager } from "@/components/journal/TradingJournalManager";

import { useTheme } from "@/context/ThemeContext";

export default function JournalPage() {
  const { workspaceMode } = useActiveAccount();
  const { theme } = useTheme();
  const isLight = theme === "light";

  if (workspaceMode === "tfc") {
    return <CompanionJournalView />;
  }

  const [userId, setUserId] = useState<string | null>(null);
  const [result, setResult]           = useState<PaginatedResult<CloudTradeWithRelations>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0,
  });
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

  // ── Load trades deterministically ──────────────────────────────────────────
  const loadTrades = useCallback(async () => {
    setLoading(true);
    try {
      let uid = userId;
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          uid = user.id;
          setUserId(user.id);
          const { data: accs } = await fetchTradingAccounts(user.id);
          if (accs) setAccounts(accs);
        }
      }

      if (!uid) {
        setResult({ data: [], total: 0, page: 1, pageSize: 25, totalPages: 0 });
        return;
      }

      const { data } = await TradeService.getTrades(uid, filters, page, pageSize, "close_time", false);
      if (data) {
        setResult(data);
      } else {
        setResult({ data: [], total: 0, page: 1, pageSize: 25, totalPages: 0 });
      }
    } catch (err) {
      console.error("Failed to load trades:", err);
      setResult({ data: [], total: 0, page: 1, pageSize: 25, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }, [userId, filters, page, pageSize]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  const handleFiltersChange = (partial: Partial<CloudTradeFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setPage(1);
  };

  useAppEventListener(
    ["tradefourge:trade-created", "tradefourge:trade-updated", "tradefourge:trade-deleted", "tradefourge:import-created", "tradefourge:import-deleted", "tradefourge:data-changed"],
    loadTrades
  );

  const handleDeleteTrade = async (id: string) => {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id || null;
    }
    if (!uid) return;

    const { data: success, error: delErr } = await TradeService.deleteTrade(id, uid);
    if (success) {
      await loadTrades();
    } else {
      alert(`Failed to delete trade: ${delErr || "Database error"}`);
    }
  };

  // No trades AND no filters applied → true empty state
  const isCompletelyEmpty =
    !loading &&
    result.total === 0 &&
    filters.search === "" &&
    filters.side === "ALL" &&
    filters.outcome === "ALL" &&
    filters.dateRange === "ALL" &&
    filters.accountId === "ALL";

  return (
    <div className="space-y-6 text-xs font-mono max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
        isLight ? "bg-white border-[#E5E7EB] shadow-sm text-slate-900" : "bg-[#111522] border-white/10 text-white"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl border ${
            isLight ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-blue-500/10 border-blue-500/20 text-blue-400"
          }`}>
            <TableProperties className="w-6 h-6" />
          </div>
          <div>
            <h1 className={`text-2xl font-extrabold tracking-tight flex items-center gap-2 font-mono ${
              isLight ? "text-slate-900" : "text-white"
            }`}>
              Trade Journal
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                isLight ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
              }`}>
                Institutional Workspace
              </span>
            </h1>
            <p className={`text-xs mt-0.5 font-sans ${isLight ? "text-slate-500" : "text-gray-400"}`}>
              {loading
                ? "Loading trade records..."
                : `${result.total.toLocaleString()} trade${result.total !== 1 ? "s" : ""} recorded`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/upload"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs font-mono transition-all ${
              isLight ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800" : "bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.08] text-gray-200"
            }`}
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Link>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs font-mono transition-all active:scale-95 shadow-sm text-white ${
              isLight ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Trade
          </button>
        </div>
      </div>

      {/* Content vs Empty State */}
      {isCompletelyEmpty ? (
        <EmptyState
          icon={TableProperties}
          title="No Trades Yet"
          description="Your trade journal is empty. Import a CSV statement from your broker to populate your trade history, or add trades manually."
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
          accounts={accounts}
        />
      )}

      {/* ── PART 2: DEDICATED TRADING JOURNAL SYSTEM ────────────────────────── */}
      <TradingJournalManager />

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
