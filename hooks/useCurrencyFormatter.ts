import { useMemo } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { formatCurrency, convertFromUSD, getCurrencySymbol, DisplayCurrency } from "@/lib/config/currency";

/**
 * Hook that returns currency-aware formatting utilities.
 * Values stored in DB are always USD; this hook converts for display.
 */
export function useCurrencyFormatter() {
  const displayCurrency = useJournalStore(state => state.displayCurrency);

  return useMemo(() => ({
    currency: displayCurrency,
    symbol: getCurrencySymbol(displayCurrency),

    /** Format an internal USD value for display */
    format: (usdValue: number) => formatCurrency(usdValue, displayCurrency),

    /** Convert without formatting (returns raw number) */
    convert: (usdValue: number) => convertFromUSD(usdValue, displayCurrency),

    /** Format with mandatory sign prefix */
    formatSigned: (usdValue: number): string => {
      const str = formatCurrency(Math.abs(usdValue), displayCurrency);
      return usdValue >= 0 ? `+${str}` : `-${str}`;
    },

    /** Format a value that is ALREADY in display currency (no conversion) */
    formatDisplay: (displayValue: number): string => {
      const absVal = Math.abs(displayValue);
      const sign   = displayValue < 0 ? "-" : "";
      const sym    = getCurrencySymbol(displayCurrency);
      return `${sign}${sym}${absVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    /** Short label for axis ticks */
    currencyLabel: (currency: DisplayCurrency): string => {
      if (currency === "USD") return "USD ($)";
      if (currency === "USC") return "USC (¢)";
      if (currency === "INR") return "INR (₹)";
      return "USD ($)";
    },
  }), [displayCurrency]);
}
