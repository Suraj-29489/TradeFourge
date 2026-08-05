import { useMemo } from "react";
import { calculateEngineStats } from "@/lib/engine/statistics-engine";
import type { NormalizedTrade } from "@/lib/engine/types";
import type { EngineStats } from "@/lib/engine/types";

/**
 * Phase 3.0 Refactor:
 * useJournalMetrics is now a lightweight hook that receives trades as a prop
 * (or returns empty defaults if none are provided).
 *
 * ── Phase 3.0 ──────────────────────────────────────────────────────────────
 * The old implementation pulled trades from Zustand + IndexedDB.
 * That is gone. Persistent trading data now lives in Supabase.
 *
 * Components that need analytics should:
 * 1. Fetch CloudTrade[] from Supabase via the trades service.
 * 2. Pass them to this hook (or calculate metrics directly).
 *
 * DashboardCharts still uses this hook but will receive an empty array
 * until the Phase 3.1 analytics engine integrates CloudTrade data.
 */
export function useJournalMetrics(trades: NormalizedTrade[] = []) {
  const stats = useMemo<EngineStats>(
    () => calculateEngineStats(trades, 0),
    [trades]
  );

  const symbols = useMemo(
    () => Array.from(new Set(trades.map((t) => t.symbol))).sort(),
    [trades]
  );

  return {
    trades,
    filteredTrades: trades,
    stats,
    symbols,
    accounts: [] as string[],
    selectedAccount: "—",
    activeJournals: [],
    dateRange: null,
    // Legacy compat
    filters: {
      search: "",
      symbol: "ALL",
      direction: "ALL" as const,
      status: "ALL" as const,
      dateRange: "ALL" as const,
    },
    settings: {
      currency: "USD" as const,
      timezone: "UTC",
      dateFormat: "YYYY-MM-DD" as const,
      theme: "dark" as const,
      initialBalance: 0,
      sidebarCollapsed: false,
      accountBalance: null,
    },
  };
}
