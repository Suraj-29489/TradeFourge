import { useMemo } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { formatCurrency, convertFromUSD, getCurrencySymbol, DisplayCurrency } from "@/lib/config/currency";

/**
 * Hook that returns currency-aware formatting utilities.
 * Components call this once and use the returned helpers — no prop drilling.
 */
export function useCurrencyFormatter() {
  const displayCurrency = useJournalStore((state) => state.displayCurrency);

  return useMemo(() => ({
    currency: displayCurrency,
    symbol: getCurrencySymbol(displayCurrency),
    format: (usdValue: number) => formatCurrency(usdValue, displayCurrency),
    convert: (usdValue: number) => convertFromUSD(usdValue, displayCurrency),
    formatSigned: (usdValue: number) => {
      const str = formatCurrency(Math.abs(usdValue), displayCurrency);
      return usdValue >= 0 ? `+${str}` : `-${str}`;
    },
  }), [displayCurrency]);
}
