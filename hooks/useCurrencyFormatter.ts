import { useMemo } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useAccounts } from "@/context/AccountsContext";
import {
  getCurrencySymbol,
  getCurrencyShortLabel,
  formatMoney,
  formatMoneySigned,
} from "@/lib/config/currencies";

/**
 * Hook that returns currency-aware formatting utilities.
 *
 * Currency is derived from the SELECTED TRADING ACCOUNTS:
 * - If all selected accounts share the same currency → use that currency.
 * - If multiple different currencies are selected → mixedCurrency = true.
 * - If no accounts are selected → fall back to Zustand displayCurrency setting.
 *
 * Values are displayed exactly as stored from CSV — NO numeric conversion.
 */
export function useCurrencyFormatter() {
  const displayCurrency = useJournalStore((state) => state.displayCurrency);
  const { accounts, selectedAccountIds } = useAccounts();

  return useMemo(() => {
    // Derive the active currency from selected accounts
    let activeCurrency = displayCurrency || "USD";
    let mixedCurrency = false;

    if (selectedAccountIds.length > 0 && !selectedAccountIds.includes("ALL")) {
      const selectedAccounts = accounts.filter((a) =>
        selectedAccountIds.includes(a.id)
      );
      if (selectedAccounts.length > 0) {
        const currencies = new Set(selectedAccounts.map((a) => a.currency));
        if (currencies.size === 1) {
          activeCurrency = selectedAccounts[0].currency;
        } else if (currencies.size > 1) {
          mixedCurrency = true;
          // Use first selected account's currency for display (user will see banner)
          activeCurrency = selectedAccounts[0].currency;
        }
      }
    } else if (selectedAccountIds.includes("ALL") && accounts.length > 0) {
      const currencies = new Set(accounts.map((a) => a.currency));
      if (currencies.size === 1) {
        activeCurrency = accounts[0].currency;
      } else if (currencies.size > 1) {
        mixedCurrency = true;
        activeCurrency = accounts[0].currency;
      }
    }

    return {
      currency: activeCurrency,
      symbol: getCurrencySymbol(activeCurrency),
      mixedCurrency,

      /** Format a stored value for display — no numeric conversion */
      format: (value: number) => formatMoney(value, activeCurrency),

      /** Return stored value unchanged (no arithmetic) */
      convert: (value: number) => value,

      /** Format with mandatory sign prefix */
      formatSigned: (value: number): string =>
        formatMoneySigned(value, activeCurrency),

      /** Format a value already in display format (no conversion) */
      formatDisplay: (displayValue: number): string =>
        formatMoney(displayValue, activeCurrency),

      /** Short label for axis ticks */
      currencyLabel: (currency: string): string =>
        getCurrencyShortLabel(currency),
    };
  }, [displayCurrency, accounts, selectedAccountIds]);
}
