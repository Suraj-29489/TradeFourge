import { ParseValidationResult, BrokerType, AccountCurrency } from "./types";
import { normalizeCsvData } from "./normalizer";

export function validateAndParseCsv(
  csvText: string,
  accountName = "Primary Account",
  accountCurrency = "USD"
): ParseValidationResult {
  const {
    trades,
    detectedCurrency,
    detectedAccountType,
    isCentAccount,
    rawProfitSum,
    normalizedProfitSum,
    lastKnownBalance,
    errors,
  } = normalizeCsvData(csvText, accountName, accountCurrency);

  // No normalization math. rawProfitSum === normalizedProfitSum.
  // Both are the exact values from the CSV.
  const roundedNormalized = parseFloat(normalizedProfitSum.toFixed(2));
  const roundedRaw = parseFloat(rawProfitSum.toFixed(2));
  const delta = Math.abs(roundedNormalized - roundedRaw);
  const isMatch = delta <= 0.1;

  const warningMessage: string | null = null;

  const broker: BrokerType = trades.length > 0 ? trades[0].broker : "Exness";

  return {
    success: trades.length > 0 && errors.length === 0,
    trades,
    broker,
    currency: (detectedCurrency as AccountCurrency) || accountCurrency,
    accountType: detectedAccountType,
    isCentAccount,
    csvTotalProfit: roundedRaw,
    normalizedTotalProfit: roundedNormalized,
    isMatch,
    delta: parseFloat(delta.toFixed(2)),
    warningMessage,
    errors,
    lastKnownBalance,
  };
}
