/**
 * lib/config/currency.ts
 * TradeFourge v3.8.2 — Backward-Compatible Currency Exports
 *
 * This file re-exports the central registry for backward compatibility.
 * All new code should import directly from '@/lib/config/currencies'.
 */

// Re-export everything from the central registry
export {
  CURRENCY_REGISTRY,
  SUPPORTED_CURRENCY_CODES,
  getCurrencySymbol,
  getCurrencyLabel,
  getCurrencyShortLabel,
  formatMoney,
  formatMoneySigned,
  type CurrencyDefinition,
} from "@/lib/config/currencies";

// Re-export account-currency helpers
export * from "@/lib/account/account-currency";

import { CURRENCY_REGISTRY, formatMoney } from "@/lib/config/currencies";

// Legacy type alias — kept for backward compatibility
export type DisplayCurrency = string;

/** @deprecated Use CURRENCY_REGISTRY from currencies.ts instead */
export const CURRENCY_LABELS: Record<string, string> = {
  USD: "USD ($)",
  USC: "USC (¢)",
  EUR: "EUR (€)",
  INR: "INR (₹)",
  GBP: "GBP (£)",
  JPY: "JPY (¥)",
  AUD: "AUD (A$)",
  CAD: "CAD (C$)",
  CHF: "CHF (CHF)",
  SGD: "SGD (S$)",
  AED: "AED (د.إ)",
};

/** @deprecated Use SUPPORTED_CURRENCY_CODES from currencies.ts instead */
export const SUPPORTED_CURRENCIES: string[] = ["USD", "USC", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "INR", "SGD", "AED"];

/**
 * @deprecated Use formatMoney from currencies.ts instead.
 * Kept for backward compatibility — delegates to the central registry.
 */
export function formatCurrency(value: number, currency: string): string {
  return formatMoney(value, currency);
}

/**
 * @deprecated No numeric conversion performed. Values displayed as-is.
 */
export function convertFromUSD(value: number, _currency: string): number {
  return value;
}

// ─── LocalStorage Persistence ────────────────────────────────────────────────
export const CURRENCY_STORAGE_KEY = "trading_journal_display_currency";

export function saveCurrencyToStorage(currency: string): void {
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  } catch {
    // SSR — ignore
  }
}

export function loadCurrencyFromStorage(): string {
  try {
    const v = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (v && CURRENCY_REGISTRY[v]) return v;
  } catch {
    // SSR — ignore
  }
  return "USD";
}
