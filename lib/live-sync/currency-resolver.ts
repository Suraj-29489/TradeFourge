// lib/live-sync/currency-resolver.ts
// TradeFourge v4.0 Automatic Currency Resolver
// Resolves live broker currency (USD, USC, EUR, GBP, INR, etc.) and updates linked Trading Account.

import { getCurrencySymbol, CURRENCY_REGISTRY } from "@/lib/config/currencies";

export function resolveBrokerCurrency(rawCurrency: string | null | undefined): string {
  if (!rawCurrency) return "USD";
  const upper = rawCurrency.toUpperCase().trim();

  if (CURRENCY_REGISTRY[upper]) {
    return upper;
  }

  if (upper.includes("CENT") || upper === "USC") return "USC";
  if (upper.includes("EUR")) return "EUR";
  if (upper.includes("GBP")) return "GBP";
  if (upper.includes("INR") || upper.includes("RUPEE")) return "INR";
  if (upper.includes("JPY") || upper.includes("YEN")) return "JPY";
  if (upper.includes("AUD")) return "AUD";
  if (upper.includes("CAD")) return "CAD";
  if (upper.includes("CHF")) return "CHF";

  return "USD";
}

export function formatCurrencyWithSymbol(currencyCode: string): string {
  const code = resolveBrokerCurrency(currencyCode);
  const symbol = getCurrencySymbol(code);
  return `${code} (${symbol})`;
}
