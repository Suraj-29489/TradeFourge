import { useMemo } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { calculateEngineStats } from "@/lib/engine/statistics-engine";
import { NormalizedTrade } from "@/lib/engine/types";
import { parseISO, isWithinInterval, subDays, startOfMonth, startOfYear } from "date-fns";

/**
 * Central metrics hook. Sources trades from selected journals only.
 * All expensive calculations are memoized.
 */
export function useJournalMetrics() {
  const journals           = useJournalStore(state => state.journals);
  const selectedJournalIds = useJournalStore(state => state.selectedJournalIds);
  const filters            = useJournalStore(state => state.filters);
  const settings           = useJournalStore(state => state.settings);

  // Stable primitive dependencies for filter comparison
  const filterSearch    = filters.search;
  const filterSymbol    = filters.symbol;
  const filterDirection = filters.direction;
  const filterStatus    = filters.status;
  const filterDateRange = filters.dateRange;

  // Active journals (selected)
  const activeJournals = useMemo(() => {
    if (selectedJournalIds.length === 0) return [];
    const idSet = new Set(selectedJournalIds);
    return journals.filter(j => idSet.has(j.id));
  }, [journals, selectedJournalIds]);

  // Flat list of all active trades
  const trades = useMemo<NormalizedTrade[]>(() => {
    return activeJournals.flatMap(j => j.trades);
  }, [activeJournals]);

  // Apply filters
  const filteredTrades = useMemo<NormalizedTrade[]>(() => {
    const now = new Date();
    return trades.filter(t => {
      // Date range filter
      if (filterDateRange !== "ALL") {
        const closeDate = parseISO(t.closeTime);
        switch (filterDateRange) {
          case "7D":
            if (!isWithinInterval(closeDate, { start: subDays(now, 7), end: now })) return false;
            break;
          case "30D":
            if (!isWithinInterval(closeDate, { start: subDays(now, 30), end: now })) return false;
            break;
          case "90D":
            if (!isWithinInterval(closeDate, { start: subDays(now, 90), end: now })) return false;
            break;
          case "THIS_MONTH":
            if (!isWithinInterval(closeDate, { start: startOfMonth(now), end: now })) return false;
            break;
          case "THIS_YEAR":
            if (!isWithinInterval(closeDate, { start: startOfYear(now), end: now })) return false;
            break;
        }
      }

      // Text search
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (
          !t.symbol.toLowerCase().includes(q) &&
          !t.comment?.toLowerCase().includes(q) &&
          !t.ticket.toLowerCase().includes(q)
        ) return false;
      }

      if (filterSymbol !== "ALL" && t.symbol !== filterSymbol) return false;
      if (filterDirection !== "ALL" && t.direction !== filterDirection) return false;
      if (filterStatus !== "ALL" && t.status !== filterStatus) return false;

      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, filterSearch, filterSymbol, filterDirection, filterStatus, filterDateRange]);

  const stats = useMemo(
    () => calculateEngineStats(filteredTrades, settings.initialBalance),
    [filteredTrades, settings.initialBalance]
  );

  // Date range from active trades
  const dateRange = useMemo<{ from: Date; to: Date } | null>(() => {
    if (trades.length === 0) return null;
    const dates = trades.map(t => parseISO(t.closeTime)).sort((a, b) => a.getTime() - b.getTime());
    return { from: dates[0], to: dates[dates.length - 1] };
  }, [trades]);

  const symbols = useMemo(
    () => Array.from(new Set(trades.map(t => t.symbol))).sort(),
    [trades]
  );

  const accounts = useMemo(() => {
    const list = Array.from(new Set(activeJournals.map(j => j.accountName)));
    return list.length > 0 ? list : ["No Journal Selected"];
  }, [activeJournals]);

  const selectedAccount = accounts[0] ?? "No Journal Selected";

  return {
    trades,
    filteredTrades,
    stats,
    accounts,
    symbols,
    selectedAccount,
    filters,
    settings,
    activeJournals,
    dateRange,
  };
}
