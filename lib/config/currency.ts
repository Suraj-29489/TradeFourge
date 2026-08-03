/**
 * Currency configuration — single source of truth.
 * Values are stored and displayed exactly as imported from CSV.
 * Account currency determines ONLY the displayed currency symbol/label.
 * 
 * NO numeric conversion. NO division. NO multiplication.
 */

export * from "@/lib/account/account-currency";

export type DisplayCurrency = "USD" | "USC" | "EUR" | "INR";

/** 1 USD = 84.5 INR. Only for INR conversion display (not USC). */
export const INR_EXCHANGE_RATE = 84.5;

/**
 * Returns value as-is — no currency conversion performed.
 * Account currency only determines the displayed symbol label.
 */
export function convertFromUSD(value: number, currency: DisplayCurrency): number {
  if (currency === "INR") return value * INR_EXCHANGE_RATE;
  // USD, USC, EUR — all display the raw stored value
  return value;
}

/**
 * Format a monetary value for display in the selected currency.
 * Values are always displayed exactly as stored from CSV.
 * Account currency changes the symbol only.
 */
export function formatCurrency(value: number, currency: DisplayCurrency): string {
  const displayValue = convertFromUSD(value, currency);
  const absVal = Math.abs(displayValue);
  const sign = value < 0 ? "-" : "";

  if (currency === "INR") {
    return `${sign}₹${absVal.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const symbol = currency === "USC" ? "¢" : currency === "EUR" ? "€" : "$";
  return `${sign}${symbol}${absVal.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Returns just the currency symbol. */
export function getCurrencySymbol(currency: DisplayCurrency): string {
  if (currency === "USD") return "$";
  if (currency === "USC") return "¢";
  if (currency === "EUR") return "€";
  if (currency === "INR") return "₹";
  return "$";
}

/** Currency label shown in the settings UI. */
export const CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  USD: "USD ($)",
  USC: "USC (¢)",
  EUR: "EUR (€)",
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
