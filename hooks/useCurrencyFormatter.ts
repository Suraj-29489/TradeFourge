import { useMemo } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { formatCurrency, convertFromUSD, getCurrencySymbol, DisplayCurrency } from "@/lib/config/currency";

/**
 * Hook that returns currency-aware formatting utilities.
 * Values from storage are displayed exactly as stored from CSV.
 * Currency only determines the symbol/label shown in the UI.
 *
 * NO numeric conversion. NO division. NO multiplication for USC.
 */
export function useCurrencyFormatter() {
  const displayCurrency = useJournalStore((state) => state.displayCurrency);

  return useMemo(
    () => ({
      currency: displayCurrency,
      symbol: getCurrencySymbol(displayCurrency),

      /** Format a stored value for display — no numeric conversion */
      format: (value: number) => formatCurrency(value, displayCurrency),

      /** Return stored value unchanged (no arithmetic) */
      convert: (value: number) => convertFromUSD(value, displayCurrency),

      /** Format with mandatory sign prefix */
      formatSigned: (value: number): string => {
        const absStr = formatCurrency(Math.abs(value), displayCurrency);
        return value >= 0 ? `+${absStr}` : `-${absStr}`;
      },

      /** Format a value already in display format (no conversion) */
      formatDisplay: (displayValue: number): string => {
        const absVal = Math.abs(displayValue);
        const sign = displayValue < 0 ? "-" : "";
        const sym = getCurrencySymbol(displayCurrency);
        return `${sign}${sym}${absVal.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      },

      /** Short label for axis ticks */
      currencyLabel: (currency: DisplayCurrency): string => {
        if (currency === "USD") return "USD ($)";
        if (currency === "USC") return "USC (¢)";
        if (currency === "EUR") return "EUR (€)";
        if (currency === "INR") return "INR (₹)";
        return "USD ($)";
      },
    }),
    [displayCurrency]
  );
}
