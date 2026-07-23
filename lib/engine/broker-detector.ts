import { BrokerType, AccountType } from "./types";

export interface DetectionResult {
  broker: BrokerType;
  currency: "USD";
  accountType: AccountType;
}

export function detectBrokerAndAccount(headers: string[], fullCsvText: string): DetectionResult {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
  const headerString = normalizedHeaders.join(" ");
  const contentUpper = fullCsvText.toUpperCase();

  // 1. Detect Broker
  let broker: BrokerType = "Exness";

  if (
    headerString.includes("ticket") ||
    headerString.includes("opening_time") ||
    headerString.includes("closing_time") ||
    headerString.includes("opening_price") ||
    headerString.includes("closing_price") ||
    contentUpper.includes("EXNESS")
  ) {
    broker = "Exness";
  } else if (
    headerString.includes("deal") ||
    headerString.includes("order") ||
    headerString.includes("metatrader")
  ) {
    broker = "MetaTrader 5";
  } else if (headerString.includes("tradestate")) {
    broker = "TradeLocker";
  } else if (headerString.includes("tradezella") || headerString.includes("setup")) {
    broker = "TradeZella";
  }

  // 2. Account Type Detection
  let accountType: AccountType = "Pro";
  if (contentUpper.includes("CENT")) {
    accountType = "Standard Cent";
  } else if (contentUpper.includes("DEMO") || contentUpper.includes("PRACTICE")) {
    accountType = "Demo";
  } else if (contentUpper.includes("RAW") || contentUpper.includes("ZERO")) {
    accountType = "Raw";
  } else if (contentUpper.includes("STANDARD")) {
    accountType = "Standard";
  }

  return { broker, currency: "USD", accountType };
}
