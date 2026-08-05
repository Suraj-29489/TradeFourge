// lib/config/currencies.ts
// TradeFourge v3.8.2 — Central Currency Registry
// SINGLE SOURCE OF TRUTH for all supported currencies.
// Every currency dropdown, formatter, and symbol lookup MUST use this registry.
// To add a new currency, add ONE entry here. No other file needs modification.

export interface CurrencyDefinition {
  code: string;
  name: string;
  symbol: string;
}

/**
 * Complete registry of every supported currency.
 * Adding a currency here automatically makes it available in every dropdown,
 * formatter, and display component across the entire application.
 */
export const CURRENCY_REGISTRY: Record<string, CurrencyDefinition> = {
  USD: { code: "USD", name: "US Dollar", symbol: "$" },
  USC: { code: "USC", name: "US Cent", symbol: "¢" },
  EUR: { code: "EUR", name: "Euro", symbol: "€" },
  GBP: { code: "GBP", name: "British Pound", symbol: "£" },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  AUD: { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  CHF: { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  INR: { code: "INR", name: "Indian Rupee", symbol: "₹" },
  SGD: { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  AED: { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
};

/** All supported currency codes, ordered for dropdown display. */
export const SUPPORTED_CURRENCY_CODES: string[] = Object.keys(CURRENCY_REGISTRY);

/**
 * Returns the currency symbol for a given code.
 * Falls back to the code itself if not found.
 */
export function getCurrencySymbol(code: string | null | undefined): string {
  if (!code) return "$";
  return CURRENCY_REGISTRY[code]?.symbol ?? code;
}

/**
 * Returns a formatted label for dropdown display.
 * Example: "$ USD — US Dollar"
 */
export function getCurrencyLabel(code: string): string {
  const entry = CURRENCY_REGISTRY[code];
  if (!entry) return code;
  return `${entry.symbol} ${entry.code} — ${entry.name}`;
}

/**
 * Returns a short label for compact display.
 * Example: "USD ($)"
 */
export function getCurrencyShortLabel(code: string): string {
  const entry = CURRENCY_REGISTRY[code];
  if (!entry) return code;
  return `${entry.code} (${entry.symbol})`;
}

/**
 * Formats a monetary value for display with the correct currency symbol.
 * Values are displayed exactly as stored — NO numeric conversion.
 */
export function formatMoney(
  value: number | null | undefined,
  currencyCode: string | null | undefined
): string {
  const val = value ?? 0;
  const absVal = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  const symbol = getCurrencySymbol(currencyCode);

  return `${sign}${symbol}${absVal.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a monetary value with explicit + / - sign prefix.
 * Example: +$25.40, -€12.30, ¢0.00
 */
export function formatMoneySigned(
  value: number | null | undefined,
  currencyCode: string | null | undefined
): string {
  const val = value ?? 0;
  const absVal = Math.abs(val);
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = absVal.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (val > 0.001) return `+${symbol}${formatted}`;
  if (val < -0.001) return `-${symbol}${formatted}`;
  return `${symbol}${formatted}`;
}
