import { ParseValidationResult, BrokerType } from "./types";
import { normalizeCsvData } from "./normalizer";

export function validateAndParseCsv(
  csvText: string,
  accountName = "Primary Account",
  accountCurrency = "USD"
): ParseValidationResult {
  const {
    trades,
    detectedAccountType,
    isCentAccount,
    rawProfitSum,
    normalizedProfitSum,
    lastKnownBalance,
    errors,
  } = normalizeCsvData(csvText, accountName, accountCurrency);

  // Validate normalized sum matches (tolerance 0.05 USD)
  const roundedNormalized = parseFloat(normalizedProfitSum.toFixed(2));
  // rawProfitSum is pre-normalization; for USD accounts they should match
  // For cent accounts, rawProfitSum is in USC so we compare against normalized*100
  const expectedRaw = isCentAccount ? normalizedProfitSum * 100 : normalizedProfitSum;
  const roundedExpectedRaw = parseFloat(expectedRaw.toFixed(2));
  const roundedRaw = parseFloat(rawProfitSum.toFixed(2));

  const delta = Math.abs(roundedExpectedRaw - roundedRaw);
  const isMatch = delta <= 0.1; // slight tolerance for floating point

  let warningMessage: string | null = null;
  if (!isMatch) {
    warningMessage = isCentAccount
      ? `USC account normalization check: raw sum was ${roundedRaw} USC → $${roundedNormalized} USD (÷100). Delta: ${delta.toFixed(2)}.`
      : `CSV profit mismatch: raw $${roundedRaw} vs normalized $${roundedNormalized}. Delta: $${delta.toFixed(2)}.`;
  }

  if (isCentAccount && !warningMessage) {
    warningMessage = `USC cent account detected — all values normalized from USC to USD (÷100).`;
  }

  const broker: BrokerType = trades.length > 0 ? trades[0].broker : "Exness";

  return {
    success: trades.length > 0 && errors.length === 0,
    trades,
    broker,
    currency: "USD",
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
