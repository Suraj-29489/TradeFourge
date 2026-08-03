/**
 * Currency configuration — single source of truth.
 * Internal DB and trade storage always represent normalized USD.
 * Display layer formats presentation consistently.
 */

export type DisplayCurrency = "USD" | "USC" | "INR";

/** 1 USD = 84.5 INR. Change only this constant to update the entire app. */
export const INR_EXCHANGE_RATE = 84.5;

/** 1 USD = 100 USC (cents). Trades are normalized to USD on import. */
export const USC_RATE = 1;

/**
 * Convert an internal USD value to the selected display currency.
 * Trades are already USD-normalized; USC displays normalized USD values.
 */
export function convertFromUSD(usdValue: number, currency: DisplayCurrency): number {
  if (currency === "USC") return usdValue; // Already USD-normalized
  if (currency === "INR") return usdValue * INR_EXCHANGE_RATE;
  return usdValue;
}

/**
 * Format an internal USD value for display in the selected currency.
 * USC displays normalized USD monetary values.
 */
export function formatCurrency(usdValue: number, currency: DisplayCurrency): string {
  const converted = convertFromUSD(usdValue, currency);
  const absConverted = Math.abs(converted);
  const sign = usdValue < 0 ? "-" : "";

  if (currency === "USD" || currency === "USC") {
    return `${sign}$${absConverted.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (currency === "INR") {
    return `${sign}₹${absConverted.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${sign}$${absConverted.toFixed(2)}`;
}

/** Returns just the currency symbol. */
export function getCurrencySymbol(currency: DisplayCurrency): string {
  if (currency === "USD" || currency === "USC") return "$";
  if (currency === "INR") return "₹";
  return "$";
}

/** Currency label shown in the settings UI. */
export const CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  USD: "USD ($)",
  USC: "USC (Cent Account)",
  INR: "INR (₹)",
};

export const SUPPORTED_CURRENCIES: DisplayCurrency[] = ["USD", "USC", "INR"];

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
