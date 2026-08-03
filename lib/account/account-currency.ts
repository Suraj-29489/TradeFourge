// lib/account/account-currency.ts
// TradeFourge v3.8.1 — Centralized USC Account Display Engine

export interface AccountCurrencyReference {
  currency?: string | null;
}

/**
 * Normalizes a monetary value based on trading account currency.
 * If account.currency === "USC", returns value / 100.
 * Otherwise returns raw value as-is.
 */
export function getAccountNormalizedValue(
  value: number | null | undefined,
  accountOrCurrency?: AccountCurrencyReference | string | null
): number {
  if (value === null || value === undefined || isNaN(value)) return 0;

  const currencyStr =
    typeof accountOrCurrency === "string"
      ? accountOrCurrency
      : accountOrCurrency?.currency;

  if (currencyStr === "USC") {
    return value / 100;
  }

  return value;
}

/**
 * Formats a monetary value according to the trading account currency.
 * If account.currency === "USC", divides value by 100 before formatting with $.
 */
export function formatAccountMoney(
  value: number | null | undefined,
  accountOrCurrency?: AccountCurrencyReference | string | null
): string {
  const normVal = getAccountNormalizedValue(value, accountOrCurrency);
  const absVal = Math.abs(normVal);
  const sign = normVal < 0 ? "-" : "";

  return `${sign}$${absVal.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a monetary value with explicit + / - sign prefix according to trading account currency.
 */
export function formatAccountMoneySigned(
  value: number | null | undefined,
  accountOrCurrency?: AccountCurrencyReference | string | null
): string {
  const normVal = getAccountNormalizedValue(value, accountOrCurrency);
  const absVal = Math.abs(normVal);

  if (normVal > 0.001) {
    return `+$${absVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (normVal < -0.001) {
    return `-$${absVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${absVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
