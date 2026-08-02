import Papa from "papaparse";
import { NormalizedTrade, Direction, TradeStatus, AccountType } from "./types";

/**
 * Parse an ISO-like timestamp from Exness CSV.
 * Format: "2026-07-23T11:36:20"
 * Returns null if invalid — never falls back to today.
 */
function parseExnessTimestamp(raw: string): Date | null {
  if (!raw || raw.trim() === "") return null;
  const d = new Date(raw.trim());
  if (!isNaN(d.getTime())) return d;
  return null;
}

function parseFloatOrNull(raw: string): number | null {
  if (!raw || raw.trim() === "") return null;
  const v = parseFloat(raw.trim());
  return isNaN(v) ? null : v;
}

/**
 * Normalize Exness CSV export.
 *
 * USC (cent account) normalization:
 *   If isCentAccount is detected, ALL monetary values (profit, commission, swap,
 *   equity/balanceAfterTrade) are divided by 100 so the DB always stores USD.
 */
export function normalizeCsvData(
  csvText: string,
  accountName = "Primary Account"
): {
  trades: NormalizedTrade[];
  detectedCurrency: "USD";
  detectedAccountType: AccountType;
  isCentAccount: boolean;
  rawProfitSum: number;
  normalizedProfitSum: number;
  lastKnownBalance: number | null;
  errors: string[];
} {
  const errors: string[] = [];
  const trades: NormalizedTrade[] = [];
  let rawProfitSum = 0;
  let normalizedProfitSum = 0;
  let lastKnownBalance: number | null = null;

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (!parsed.data || parsed.data.length === 0) {
    return {
      trades: [],
      detectedCurrency: "USD",
      detectedAccountType: "Standard",
      isCentAccount: false,
      rawProfitSum: 0,
      normalizedProfitSum: 0,
      lastKnownBalance: null,
      errors: ["CSV file is empty or could not be parsed."],
    };
  }

  // ── Detect account type ────────────────────────────────────────────────────
  let detectedAccountType: AccountType = "Pro";
  const textUpper = csvText.toUpperCase();
  if (
    textUpper.includes("CENT") ||
    textUpper.includes("USC") ||
    textUpper.includes("US CENT") ||
    textUpper.includes("CENTS")
  ) {
    detectedAccountType = "Standard Cent";
  } else if (textUpper.includes("STANDARD")) {
    detectedAccountType = "Standard";
  } else if (textUpper.includes("RAW") || textUpper.includes("ZERO")) {
    detectedAccountType = "Raw";
  } else if (textUpper.includes("DEMO")) {
    detectedAccountType = "Demo";
  }

  // ── USC / Cent account detection ───────────────────────────────────────────
  // Cent accounts store values in USC (cents). 100 USC = 1 USD.
  // We divide all monetary values by 100 to store USD internally.
  const isCentAccount =
    detectedAccountType === "Standard Cent" ||
    textUpper.includes("CENT") ||
    textUpper.includes("USC") ||
    textUpper.includes("US CENT") ||
    textUpper.includes("CENTS");

  const normFactor = isCentAccount ? 100 : 1;

  const seenTickets = new Set<string>();

  parsed.data.forEach((row, index) => {
    // ── Column mapping (confirmed Exness CSV headers) ──────────────────────
    const ticketRaw      = (row["ticket"]              ?? "").trim();
    const openTimeRaw    = (row["opening_time_utc"]    ?? "").trim();
    const closeTimeRaw   = (row["closing_time_utc"]    ?? "").trim();
    const typeRaw        = (row["type"]                ?? "").trim().toLowerCase();
    const lotsRaw        = (row["lots"]                ?? "").trim();
    const symbolRaw      = (row["symbol"]              ?? "").trim().toUpperCase();
    const openPriceRaw   = (row["opening_price"]       ?? "").trim();
    const closePriceRaw  = (row["closing_price"]       ?? "").trim();
    const stopLossRaw    = (row["stop_loss"]           ?? "").trim();
    const takeProfitRaw  = (row["take_profit"]         ?? "").trim();
    const commissionRaw  = (row["commission"]          ?? "").trim();
    const swapRaw        = (row["swap"]                ?? "").trim();
    const profitRaw      = (row["profit"]              ?? "").trim();
    const equityRaw      = (row["equity"]              ?? "").trim();
    const closeReasonRaw = (row["close_reason"]        ?? "").trim();

    // ── Track last known equity (normalize to USD) ────────────────────────
    const equityVal = parseFloatOrNull(equityRaw);
    if (equityVal !== null) {
      lastKnownBalance = equityVal / normFactor;
    }

    // ── Unique ticket ────────────────────────────────────────────────────
    let ticket = ticketRaw !== "" ? ticketRaw : `POS-${index + 1}`;
    if (seenTickets.has(ticket)) ticket = `${ticket}_dup${index + 1}`;
    seenTickets.add(ticket);

    // ── Timestamps ────────────────────────────────────────────────────────
    const parsedOpenDate  = parseExnessTimestamp(openTimeRaw);
    const parsedCloseDate = parseExnessTimestamp(closeTimeRaw);

    if (!parsedCloseDate) {
      errors.push(`Row ${index + 1} (Ticket: ${ticket}): Invalid closing_time_utc "${closeTimeRaw}" — skipped.`);
      return;
    }

    const openTime  = parsedOpenDate ? parsedOpenDate.toISOString()  : null;
    const closeTime = parsedCloseDate.toISOString();

    let holdDurationMs: number | null = null;
    if (parsedOpenDate) {
      const diff = parsedCloseDate.getTime() - parsedOpenDate.getTime();
      if (diff >= 0) holdDurationMs = diff;
    }

    // ── Numeric fields ─────────────────────────────────────────────────────
    const volume     = parseFloat(lotsRaw) || 0.01;
    const openPrice  = parseFloatOrNull(openPriceRaw);
    const closePrice = parseFloatOrNull(closePriceRaw) ?? openPrice ?? 0;
    const stopLoss   = parseFloatOrNull(stopLossRaw);
    const takeProfit = parseFloatOrNull(takeProfitRaw);

    // Raw profit sum (pre-normalization, for validation)
    const profitRaw_ = parseFloatOrNull(profitRaw) ?? 0;
    rawProfitSum += profitRaw_;

    // Normalize monetary values to USD
    const commission       = Math.abs(parseFloatOrNull(commissionRaw) ?? 0) / normFactor;
    const swap             = (parseFloatOrNull(swapRaw) ?? 0) / normFactor;
    const profit           = profitRaw_ / normFactor;
    const balanceAfterTrade = equityVal !== null ? equityVal / normFactor : null;

    normalizedProfitSum += profit;

    // ── Direction & Status ────────────────────────────────────────────────
    const direction: Direction = typeRaw === "buy" || typeRaw === "long" ? "LONG" : "SHORT";

    let status: TradeStatus = "BREAKEVEN";
    if (profit > 0.001) status = "WIN";
    else if (profit < -0.001) status = "LOSS";

    // ── Risk:Reward (only when SL present) ───────────────────────────────
    let rr: number | null = null;
    if (openPrice !== null && stopLoss !== null) {
      const riskDist = Math.abs(openPrice - stopLoss);
      if (riskDist > 0) {
        const rewardDist = Math.abs(closePrice - openPrice);
        rr = status === "LOSS" ? -1.0 : parseFloat((rewardDist / riskDist).toFixed(2));
      }
    }

    trades.push({
      ticket,
      openTime,
      closeTime,
      symbol: symbolRaw || "UNKNOWN",
      direction,
      volume,
      openPrice,
      closePrice,
      commission:       parseFloat(commission.toFixed(2)),
      swap:             parseFloat(swap.toFixed(2)),
      profit:           parseFloat(profit.toFixed(2)),
      currency:         "USD",
      accountType:      detectedAccountType,
      accountName,
      broker:           "Exness",
      stopLoss,
      takeProfit,
      rr,
      status,
      holdDurationMs,
      balanceAfterTrade,
      closeReason: closeReasonRaw || undefined,
    });
  });

  return {
    trades,
    detectedCurrency:   "USD",
    detectedAccountType,
    isCentAccount,
    rawProfitSum:        parseFloat(rawProfitSum.toFixed(2)),
    normalizedProfitSum: parseFloat(normalizedProfitSum.toFixed(2)),
    lastKnownBalance,
    errors,
  };
}

/**
 * Generate a fingerprint for duplicate detection.
 * Uses: ticket + openTime + closeTime + symbol + lots + profit (raw string values).
 */
export function tradeFingerprint(row: {
  ticket: string;
  openTime: string | null;
  closeTime: string;
  symbol: string;
  volume: number;
  profit: number;
}): string {
  return [row.ticket, row.openTime ?? "", row.closeTime, row.symbol, row.volume, row.profit].join("|");
}
