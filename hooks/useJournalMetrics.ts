import { useMemo } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { calculateEngineStats } from "@/lib/engine/statistics-engine";
import { NormalizedTrade } from "@/lib/engine/types";

/**
 * Central metrics hook. All expensive calculations are memoized.
 * Only recalculates when trade data or filters change.
 */
export function useJournalMetrics() {
  const trades = useJournalStore((state) => state.trades);
  const selectedAccount = useJournalStore((state) => state.selectedAccount);
  const filters = useJournalStore((state) => state.filters);
  const settings = useJournalStore((state) => state.settings);

  // Stable primitive dependencies for filter comparison
  const filterSearch = filters.search;
  const filterSymbol = filters.symbol;
  const filterDirection = filters.direction;
  const filterStatus = filters.status;

  const filteredTrades = useMemo(() => {
    return trades.filter((t: NormalizedTrade) => {
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (
          !t.symbol.toLowerCase().includes(q) &&
          !t.comment?.toLowerCase().includes(q) &&
          !t.ticket.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filterSymbol !== "ALL" && t.symbol !== filterSymbol) return false;
      if (filterDirection !== "ALL" && t.direction !== filterDirection) return false;
      if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, selectedAccount, filterSearch, filterSymbol, filterDirection, filterStatus]);

  const stats = useMemo(
    () => calculateEngineStats(filteredTrades, settings.initialBalance),
    [filteredTrades, settings.initialBalance]
  );

  const accounts = useMemo(() => {
    const list = Array.from(new Set(trades.map((t: NormalizedTrade) => t.accountName)));
    if (list.length === 0) return ["Primary Account"];
    return list;
  }, [trades]);

  const symbols = useMemo(
    () => Array.from(new Set(trades.map((t: NormalizedTrade) => t.symbol))).sort(),
    [trades]
  );

  return {
    trades,
    filteredTrades,
    stats,
    accounts,
    symbols,
    selectedAccount,
    filters,
    settings,
  };
}
