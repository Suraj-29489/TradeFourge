// lib/engine/validation/broker-detector.ts
// TradeFourge v3.7.1 — CSV Validation Engine: Step 4 (Broker Format Detector)

export type DetectedBroker = "Exness" | "MetaTrader 4" | "MetaTrader 5" | "FTMO" | "IC Markets" | "cTrader" | "Generic Broker" | "Unknown";

export interface BrokerDetectionResult {
  isSupported: boolean;
  broker: DetectedBroker;
  platformName: string;
  explanation: string | null;
}

/**
 * Identifies broker/platform format from raw text and header lines.
 */
export function detectBrokerFormat(csvText: string, headers: string[]): BrokerDetectionResult {
  const textUpper = csvText.toUpperCase();
  const headersLower = headers.map((h) => h.toLowerCase()).join(" ");

  // 1. Exness Report Detection
  if (textUpper.includes("EXNESS") || headersLower.includes("account currency") || textUpper.includes("REALIZED P/L")) {
    return {
      isSupported: true,
      broker: "Exness",
      platformName: "Exness Terminal / MetaTrader",
      explanation: null,
    };
  }

  // 2. FTMO Account Statement Detection
  if (textUpper.includes("FTMO") || textUpper.includes("METATRADER 5 STATEMENT") || textUpper.includes("METATRADER 4 STATEMENT")) {
    return {
      isSupported: true,
      broker: "FTMO",
      platformName: "FTMO Proprietary / MT4 / MT5",
      explanation: null,
    };
  }

  // 3. IC Markets Statement Detection
  if (textUpper.includes("IC MARKETS") || textUpper.includes("ICMARKETS")) {
    return {
      isSupported: true,
      broker: "IC Markets",
      platformName: "IC Markets MetaTrader",
      explanation: null,
    };
  }

  // 4. MetaTrader 5 Report Structure (Ticket, Open Time, Type, Size, Symbol, Open Price, S/L, T/P, Close Time, Close Price, Commission, Swap, Profit)
  if (
    headersLower.includes("ticket") &&
    headersLower.includes("open time") &&
    headersLower.includes("close time") &&
    headersLower.includes("profit")
  ) {
    return {
      isSupported: true,
      broker: "MetaTrader 5",
      platformName: "MetaTrader 5 Standard CSV Report",
      explanation: null,
    };
  }

  // 5. MetaTrader 4 Report Structure
  if (
    headersLower.includes("order") &&
    headersLower.includes("time") &&
    headersLower.includes("item") &&
    headersLower.includes("profit")
  ) {
    return {
      isSupported: true,
      broker: "MetaTrader 4",
      platformName: "MetaTrader 4 Standard CSV Report",
      explanation: null,
    };
  }

  // 6. cTrader Report Structure
  if (headersLower.includes("position id") || headersLower.includes("entry price") || headersLower.includes("closing price")) {
    return {
      isSupported: true,
      broker: "cTrader",
      platformName: "cTrader Export Statement",
      explanation: null,
    };
  }

  // 7. Generic Broker Detection (has minimal required headers)
  if (
    headersLower.includes("symbol") ||
    headersLower.includes("type") ||
    headersLower.includes("side") ||
    headersLower.includes("profit") ||
    headersLower.includes("pnl")
  ) {
    return {
      isSupported: true,
      broker: "Generic Broker",
      platformName: "Generic Broker CSV Statement",
      explanation: null,
    };
  }

  // 8. Unsupported Format
  return {
    isSupported: false,
    broker: "Unknown",
    platformName: "Unrecognized Statement Format",
    explanation:
      "Unsupported broker statement format. Please upload a standard MT4, MT5, Exness, FTMO, or cTrader CSV report.",
  };
}
