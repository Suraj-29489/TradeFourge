// lib/account/account-currency.ts
// TradeFourge v3.8.2 — Account Currency Helpers
// Delegates all symbol resolution and formatting to the central registry.
// No hardcoded symbol if-chains.

import {
  getCurrencySymbol as registryGetSymbol,
  formatMoney,
  formatMoneySigned,
} from "@/lib/config/currencies";

export interface AccountCurrencyReference {
  currency?: string | null;
}

/**
 * Returns the currency symbol for an account or currency code string.
 * Resolves through the central registry.
 */
export function getAccountCurrencySymbol(
  accountOrCurrency?: AccountCurrencyReference | string | null
): string {
  const currencyStr =
    typeof accountOrCurrency === "string"
      ? accountOrCurrency
      : accountOrCurrency?.currency;

  return registryGetSymbol(currencyStr);
}

/**
 * Formats a monetary value for display using the account's currency.
 * Values are displayed exactly as stored — NO conversion.
 */
export function formatAccountMoney(
  value: number | null | undefined,
  accountOrCurrency?: AccountCurrencyReference | string | null
): string {
  const currencyStr =
    typeof accountOrCurrency === "string"
      ? accountOrCurrency
      : accountOrCurrency?.currency;

  return formatMoney(value, currencyStr);
}

/**
 * Formats a monetary value with explicit + / - sign prefix.
 * Values are displayed exactly as stored — NO conversion.
 */
export function formatAccountMoneySigned(
  value: number | null | undefined,
  accountOrCurrency?: AccountCurrencyReference | string | null
): string {
  const currencyStr =
    typeof accountOrCurrency === "string"
      ? accountOrCurrency
      : accountOrCurrency?.currency;

  return formatMoneySigned(value, currencyStr);
}

/**
 * Legacy compatibility — returns value as-is (no conversion).
 * @deprecated Use formatAccountMoney instead.
 */
export function getAccountNormalizedValue(
  value: number | null | undefined,
  _accountOrCurrency?: AccountCurrencyReference | string | null
): number {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return value;
}
