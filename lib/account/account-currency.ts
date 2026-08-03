// lib/account/account-currency.ts
// TradeFourge v3.8.1 — Centralized Display Engine
// IMPORTANT: No numeric conversion. Values are stored and displayed exactly as imported from CSV.
// Account currency determines ONLY the displayed currency symbol/label.

export interface AccountCurrencyReference {
  currency?: string | null;
}

/**
 * Returns the currency symbol for a given account currency.
 * USD → $ | USC → ¢ | EUR → € | INR → ₹ | default → $
 * 
 * NOTE: This does NOT perform any arithmetic on values.
 */
export function getAccountCurrencySymbol(
  accountOrCurrency?: AccountCurrencyReference | string | null
): string {
  const currencyStr =
    typeof accountOrCurrency === "string"
      ? accountOrCurrency
      : accountOrCurrency?.currency;

  if (currencyStr === "USD") return "$";
  if (currencyStr === "USC") return "¢";
  if (currencyStr === "EUR") return "€";
  if (currencyStr === "INR") return "₹";
  return "$";
}

/**
 * Formats a monetary value for display.
 * Values are stored and displayed exactly as-is from the CSV.
 * Account currency only determines the currency symbol shown.
 * 
 * NO division. NO multiplication. NO conversion.
 */
export function formatAccountMoney(
  value: number | null | undefined,
  accountOrCurrency?: AccountCurrencyReference | string | null
): string {
  const val = value ?? 0;
  const absVal = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  const symbol = getAccountCurrencySymbol(accountOrCurrency);

  return `${sign}${symbol}${absVal.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a monetary value with explicit + / - sign prefix.
 * Values are displayed exactly as-is from the CSV.
 * 
 * NO division. NO multiplication. NO conversion.
 */
export function formatAccountMoneySigned(
  value: number | null | undefined,
  accountOrCurrency?: AccountCurrencyReference | string | null
): string {
  const val = value ?? 0;
  const absVal = Math.abs(val);
  const symbol = getAccountCurrencySymbol(accountOrCurrency);

  if (val > 0.001) {
    return `+${symbol}${absVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (val < -0.001) {
    return `-${symbol}${absVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${symbol}${absVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
