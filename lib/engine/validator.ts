import { ParseValidationResult, BrokerType } from "./types";
import { normalizeCsvData } from "./normalizer";

export function validateAndParseCsv(
  csvText: string,
  accountName = "Primary Account"
): ParseValidationResult {
  const { trades, detectedAccountType, rawProfitSum, lastKnownBalance, errors } =
    normalizeCsvData(csvText, accountName);

  const normalizedTotalProfit = trades.reduce((acc, t) => acc + t.profit, 0);
  const roundedNormalized = parseFloat(normalizedTotalProfit.toFixed(2));
  const roundedRaw = parseFloat(rawProfitSum.toFixed(2));

  const delta = Math.abs(roundedNormalized - roundedRaw);
  const isMatch = delta <= 0.05;

  let warningMessage: string | null = null;
  if (!isMatch) {
    warningMessage = `CSV parsing mismatch detected. Raw CSV PnL ($${roundedRaw}) differs from normalized sum ($${roundedNormalized}).`;
  }

  const broker: BrokerType = trades.length > 0 ? trades[0].broker : "Exness";

  return {
    success: trades.length > 0 && errors.length === 0,
    trades,
    broker,
    currency: "USD",
    accountType: detectedAccountType,
    csvTotalProfit: roundedRaw,
    normalizedTotalProfit: roundedNormalized,
    isMatch,
    delta: parseFloat(delta.toFixed(2)),
    warningMessage,
    errors,
    lastKnownBalance,
  };
}
