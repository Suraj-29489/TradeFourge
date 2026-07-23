import Papa from "papaparse";
import { NormalizedTrade, Direction, TradeStatus, AccountType } from "./types";

/**
 * Parse an ISO-8601-like timestamp from Exness CSV.
 * Format observed: "2026-07-23T11:36:20"
 * Returns a Date object or null — NEVER falls back to today's date.
 */
function parseExnessTimestamp(raw: string): Date | null {
  if (!raw || raw.trim() === "") return null;
  const d = new Date(raw.trim());
  if (!isNaN(d.getTime())) return d;
  return null;
}

/** Parse a float, returning null if the raw string is empty or unparseable. */
function parseFloatOrNull(raw: string): number | null {
  if (!raw || raw.trim() === "") return null;
  const v = parseFloat(raw.trim());
  return isNaN(v) ? null : v;
}

export function normalizeCsvData(
  csvText: string,
  accountName = "Primary Account"
): {
  trades: NormalizedTrade[];
  detectedCurrency: "USD";
  detectedAccountType: AccountType;
  rawProfitSum: number;
  lastKnownBalance: number | null;
  errors: string[];
} {
  const errors: string[] = [];
  const trades: NormalizedTrade[] = [];
  let rawProfitSum = 0;
  let lastKnownBalance: number | null = null;

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    // Keep headers exactly as-is (Exness CSV already uses lowercase)
    transformHeader: (h) => h.trim(),
  });

  if (!parsed.data || parsed.data.length === 0) {
    return {
      trades: [],
      detectedCurrency: "USD",
      detectedAccountType: "Standard",
      rawProfitSum: 0,
      lastKnownBalance: null,
      errors: ["CSV file is empty or could not be parsed."],
    };
  }

  // Detect account type from CSV text
  let detectedAccountType: AccountType = "Pro";
  const textUpper = csvText.toUpperCase();
  if (textUpper.includes("CENT")) detectedAccountType = "Standard Cent";
  else if (textUpper.includes("STANDARD")) detectedAccountType = "Standard";
  else if (textUpper.includes("RAW") || textUpper.includes("ZERO")) detectedAccountType = "Raw";
  else if (textUpper.includes("DEMO")) detectedAccountType = "Demo";

  const seenTickets = new Set<string>();

  parsed.data.forEach((row, index) => {
    // ── EXACT column mapping — confirmed from user's Exness CSV ──────────────
    // Headers: ticket, opening_time_utc, closing_time_utc, type, lots,
    //   original_position_size, symbol, opening_price, closing_price,
    //   stop_loss, take_profit, commission, swap, profit, equity,
    //   margin_level, close_reason

    const ticketRaw = (row["ticket"] ?? "").trim();
    const openTimeRaw = (row["opening_time_utc"] ?? "").trim();
    const closeTimeRaw = (row["closing_time_utc"] ?? "").trim();
    const typeRaw = (row["type"] ?? "").trim().toLowerCase();
    const lotsRaw = (row["lots"] ?? "").trim();
    const symbolRaw = (row["symbol"] ?? "").trim().toUpperCase();
    const openPriceRaw = (row["opening_price"] ?? "").trim();
    const closePriceRaw = (row["closing_price"] ?? "").trim();
    const stopLossRaw = (row["stop_loss"] ?? "").trim();
    const takeProfitRaw = (row["take_profit"] ?? "").trim();
    const commissionRaw = (row["commission"] ?? "").trim();
    const swapRaw = (row["swap"] ?? "").trim();
    const profitRaw = (row["profit"] ?? "").trim();
    const equityRaw = (row["equity"] ?? "").trim();
    const closeReasonRaw = (row["close_reason"] ?? "").trim();
    // margin_level is intentionally ignored

    // ── Track last non-empty equity value ────────────────────────────────────
    const equityVal = parseFloatOrNull(equityRaw);
    if (equityVal !== null) {
      lastKnownBalance = equityVal;
    }

    // ── Unique ticket ─────────────────────────────────────────────────────────
    let ticket = ticketRaw !== "" ? ticketRaw : `POS-${index + 1}`;
    if (seenTickets.has(ticket)) {
      ticket = `${ticket}_${index + 1}`;
    }
    seenTickets.add(ticket);

    // ── Timestamps ────────────────────────────────────────────────────────────
    const parsedOpenDate = parseExnessTimestamp(openTimeRaw);
    const parsedCloseDate = parseExnessTimestamp(closeTimeRaw);

    if (!parsedCloseDate) {
      errors.push(
        `Row ${index + 1} (Ticket: ${ticket}): Missing or invalid closing_time_utc: "${closeTimeRaw}". Row skipped.`
      );
      return;
    }

    const openTime = parsedOpenDate ? parsedOpenDate.toISOString() : null;
    const closeTime = parsedCloseDate.toISOString();

    let holdDurationMs: number | null = null;
    if (parsedOpenDate) {
      const diff = parsedCloseDate.getTime() - parsedOpenDate.getTime();
      if (diff >= 0) holdDurationMs = diff;
    }

    // ── Numeric fields ────────────────────────────────────────────────────────
    const volume = parseFloat(lotsRaw) || 0.01;
    const openPrice = parseFloatOrNull(openPriceRaw);
    const closePrice = parseFloatOrNull(closePriceRaw) ?? openPrice ?? 0;
    const stopLoss = parseFloatOrNull(stopLossRaw);
    const takeProfit = parseFloatOrNull(takeProfitRaw);
    const commission = parseFloatOrNull(commissionRaw) ?? 0;
    const swap = parseFloatOrNull(swapRaw) ?? 0;
    const profit = parseFloatOrNull(profitRaw) ?? 0;
    const balanceAfterTrade = parseFloatOrNull(equityRaw);

    rawProfitSum += profit;

    // ── Direction & Status ────────────────────────────────────────────────────
    const direction: Direction =
      typeRaw === "buy" || typeRaw === "long" ? "LONG" : "SHORT";

    let status: TradeStatus = "BREAKEVEN";
    if (profit > 0.01) status = "WIN";
    else if (profit < -0.01) status = "LOSS";

    // ── Risk:Reward (only when SL is present and valid) ───────────────────────
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
      commission: parseFloat(Math.abs(commission).toFixed(2)),
      swap: parseFloat(swap.toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      currency: "USD",
      accountType: detectedAccountType,
      accountName,
      broker: "Exness",
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
    detectedCurrency: "USD",
    detectedAccountType,
    rawProfitSum: parseFloat(rawProfitSum.toFixed(2)),
    lastKnownBalance,
    errors,
  };
}
