/**
 * Currency configuration — single source of truth.
 * Symbol-only switching without numeric rate conversions.
 */

export type DisplayCurrency = "USD" | "USC" | "INR";

/**
 * Returns raw value directly — conversion disabled per user specification.
 */
export function convertFromUSD(value: number, _currency: DisplayCurrency): number {
  return value;
}

/**
 * Format a value for display in the selected currency symbol.
 * Does NOT alter or convert the numeric value.
 */
export function formatCurrency(value: number, currency: DisplayCurrency): string {
  const formattedNum = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const sign = value < 0 ? "-" : "";

  if (currency === "USD") {
    return `${sign}$${formattedNum}`;
  }
  if (currency === "USC") {
    return `${sign}¢${formattedNum}`;
  }
  if (currency === "INR") {
    return `${sign}₹${formattedNum}`;
  }
  return `${sign}$${formattedNum}`;
}

/**
 * Returns just the currency symbol for the selected currency.
 */
export function getCurrencySymbol(currency: DisplayCurrency): string {
  if (currency === "USD") return "$";
  if (currency === "USC") return "¢";
  if (currency === "INR") return "₹";
  return "$";
}

/** Currency label shown in the UI */
export const CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  USD: "USD ($)",
  USC: "USC (¢)",
  INR: "INR (₹)",
};

export const SUPPORTED_CURRENCIES: DisplayCurrency[] = ["USD", "USC", "INR"];

/** localStorage key for persisting currency selection */
export const CURRENCY_STORAGE_KEY = "trading_journal_display_currency";

export function saveCurrencyToStorage(currency: DisplayCurrency): void {
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  } catch {
    // SSR — ignore
  }
}

export function loadCurrencyFromStorage(): DisplayCurrency {
  try {
    const v = localStorage.getItem(CURRENCY_STORAGE_KEY) as DisplayCurrency | null;
    if (v && (v === "USD" || v === "USC" || v === "INR")) return v;
  } catch {
    // SSR — ignore
  }
  return "USD";
}
