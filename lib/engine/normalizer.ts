import Papa from "papaparse";
import { NormalizedTrade, Direction, TradeStatus, AccountType } from "./types";

/**
 * Phase 6 Symbol Canonicalization Engine
 * Maps broker-specific ticker suffixes and synonyms to canonical standard symbols.
 * Examples: XAUUSDm / GOLD / XAUUSD.ecn -> XAUUSD; NAS100.cash / USTEC -> NAS100
 */
export function canonicalizeSymbol(rawSymbol: string): string {
  if (!rawSymbol || !rawSymbol.trim()) return "UNKNOWN";

  let sym = rawSymbol.trim().toUpperCase();

  // Remove common broker suffixes (.m, .b, .ecn, .cash, _raw, _i, .std, .pro, .v, #)
  sym = sym
    .replace(/\.(ECN|CASH|RAW|STD|PRO|V|B|M|I)$/i, "")
    .replace(/(_RAW|_ECN|_STD|_PRO|_I|_M)$/i, "")
    .replace(/^#/g, "");

  // If trailing "M" on standard 6-char forex pair (e.g. EURUSDm -> EURUSD)
  if (sym.length === 7 && sym.endsWith("M")) {
    sym = sym.substring(0, 6);
  }

  // Synonym Mapping Dictionary
  const SYNONYM_MAP: Record<string, string> = {
    GOLD: "XAUUSD",
    SILVER: "XAGUSD",
    DJ30: "US30",
    WS30: "US30",
    DOW30: "US30",
    USTEC: "NAS100",
    NDX100: "NAS100",
    US100: "NAS100",
    NASDAQ: "NAS100",
    US500: "SPX500",
    SP500: "SPX500",
    XBTUSD: "BTCUSD",
    BTC: "BTCUSD",
    ETH: "ETHUSD",
  };

  return SYNONYM_MAP[sym] || sym;
}

/**
 * Phase 6 Trade Direction Normalizer
 * Standardizes BUY / LONG / SELL / SHORT / 0 / 1 / buy_limit into canonical "LONG" | "SHORT"
 */
export function normalizeTradeDirection(rawType: string): Direction {
  if (!rawType) return "LONG";
  const clean = rawType.trim().toLowerCase();

  if (
    clean === "buy" ||
    clean === "long" ||
    clean === "0" ||
    clean === "0.0" ||
    clean === "cmd 0" ||
    clean.startsWith("buy")
  ) {
    return "LONG";
  }

  if (
    clean === "sell" ||
    clean === "short" ||
    clean === "1" ||
    clean === "1.0" ||
    clean === "cmd 1" ||
    clean.startsWith("sell")
  ) {
    return "SHORT";
  }

  return "LONG";
}

/**
 * Phase 6 Unified Timestamp Normalizer
 * Converts ISO 8601, MT4/MT5 dot-notation (YYYY.MM.DD HH:MM:SS), US slash (MM/DD/YYYY),
 * and EU slash (DD/MM/YYYY) into ISO 8601 UTC strings.
 */
export function normalizeTimestamp(raw: string): string | null {
  if (!raw || raw.trim() === "") return null;
  const str = raw.trim();

  // Try direct JS Date parse
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();

  // Handle MetaTrader dot notation: "2026.07.23 11:36:20" or "2026.07.23 11:36"
  if (str.includes(".")) {
    const isoDot = str.replace(/\./g, "-").replace(" ", "T");
    d = new Date(isoDot);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Handle Slash notation: "07/23/2026 11:36:20" or "23/07/2026 11:36:20"
  if (str.includes("/")) {
    const parts = str.split(" ");
    const dateParts = parts[0].split("/");
    if (dateParts.length === 3) {
      // If YYYY/MM/DD
      if (dateParts[0].length === 4) {
        const iso = `${dateParts[0]}-${dateParts[1].padStart(2, "0")}-${dateParts[2].padStart(2, "0")}T${parts[1] || "00:00:00"}`;
        d = new Date(iso);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
      // MM/DD/YYYY or DD/MM/YYYY
      else {
        const month = parseInt(dateParts[0], 10);
        const day = parseInt(dateParts[1], 10);
        const year = dateParts[2];
        if (month > 12) {
          // EU format DD/MM/YYYY
          const iso = `${year}-${dateParts[1].padStart(2, "0")}-${dateParts[0].padStart(2, "0")}T${parts[1] || "00:00:00"}`;
          d = new Date(iso);
          if (!isNaN(d.getTime())) return d.toISOString();
        } else {
          // US format MM/DD/YYYY
          const iso = `${year}-${dateParts[0].padStart(2, "0")}-${dateParts[1].padStart(2, "0")}T${parts[1] || "00:00:00"}`;
          d = new Date(iso);
          if (!isNaN(d.getTime())) return d.toISOString();
        }
      }
    }
  }

  return null;
}

function parseFloatOrNull(raw: string): number | null {
  if (!raw || raw.trim() === "") return null;
  const v = parseFloat(raw.trim());
  return isNaN(v) ? null : v;
}

/**
 * Phase 6 Data Normalization Engine
 * Standardizes every imported trade into one internal structure prior to storage.
 */
export function normalizeCsvData(
  csvText: string,
  accountName = "Primary Account",
  accountCurrency = "USD"
): {
  trades: NormalizedTrade[];
  detectedCurrency: string;
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
      errors: ["This CSV file contains no readable rows of data."],
    };
  }

  // Account Type & Currency determination (Selected Trading Account is the Single Source of Truth)
  let detectedAccountType: AccountType = accountCurrency === "USC" ? "Standard Cent" : "Standard";
  const isCentAccount = accountCurrency === "USC";

  // CSV values are imported as-is. Display division (/100) is controlled by Trading Account currency.
  const normFactor = 1;
  const seenTickets = new Set<string>();

  parsed.data.forEach((row, index) => {
    // Dynamic Header Access (Supporting flexible column mapping)
    const findValue = (aliases: string[]): string => {
      for (const [k, v] of Object.entries(row)) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (aliases.some((alias) => cleanK === alias || cleanK.includes(alias) || alias.includes(cleanK))) {
          return (v ?? "").trim();
        }
      }
      return "";
    };

    const ticketRaw      = findValue(["ticket", "order", "position", "deal", "id"]);
    const openTimeRaw    = findValue(["opentime", "openingtime", "timeopen", "dateopen", "opened", "time"]);
    const closeTimeRaw   = findValue(["closetime", "closingtime", "timeclose", "dateclose", "closed", "time"]);
    const typeRaw        = findValue(["type", "side", "direction", "action", "cmd"]);
    const lotsRaw        = findValue(["volume", "lots", "size", "amount", "quantity"]);
    const symbolRaw      = findValue(["symbol", "item", "pair", "instrument", "asset"]);
    const openPriceRaw   = findValue(["openprice", "openingprice", "entryprice"]);
    const closePriceRaw  = findValue(["closeprice", "closingprice", "exitprice"]);
    const stopLossRaw    = findValue(["sl", "stoploss", "s/l"]);
    const takeProfitRaw  = findValue(["tp", "takeprofit", "t/p"]);
    const commissionRaw  = findValue(["commission", "comm", "fee", "fees"]);
    const swapRaw        = findValue(["swap", "rollover", "interest"]);
    const profitRaw      = findValue(["profit", "pnl", "netprofit", "gain"]);
    const equityRaw      = findValue(["equity", "balance"]);

    // Track last known equity (normalize to USD)
    const equityVal = parseFloatOrNull(equityRaw);
    if (equityVal !== null) {
      lastKnownBalance = equityVal / normFactor;
    }

    // Ticket Normalization
    let ticket = ticketRaw !== "" ? ticketRaw : `TKT-${index + 1}`;
    if (seenTickets.has(ticket)) ticket = `${ticket}_dup${index + 1}`;
    seenTickets.add(ticket);

    // Date Unification
    const openIso  = normalizeTimestamp(openTimeRaw);
    const closeIso = normalizeTimestamp(closeTimeRaw) || openIso;

    if (!closeIso) {
      errors.push(`Row ${index + 1} (Ticket: ${ticket}): Unparseable close date format "${closeTimeRaw}".`);
      return;
    }

    let holdDurationMs: number | null = null;
    if (openIso && closeIso) {
      const openD = new Date(openIso);
      const closeD = new Date(closeIso);
      const diff = closeD.getTime() - openD.getTime();
      if (diff >= 0) holdDurationMs = diff;
    }

    // Symbol Canonicalization
    const canonicalSymbol = canonicalizeSymbol(symbolRaw);

    // Direction Normalization
    const direction = normalizeTradeDirection(typeRaw);

    // Volume Normalization
    const volume = Math.abs(parseFloat(lotsRaw)) || 0.01;

    // Price Normalization
    const openPrice  = parseFloatOrNull(openPriceRaw);
    const closePrice = parseFloatOrNull(closePriceRaw) ?? openPrice ?? 0;
    const stopLoss   = parseFloatOrNull(stopLossRaw);
    const takeProfit = parseFloatOrNull(takeProfitRaw);

    // Monetary Normalization (USC -> USD)
    const profitRaw_ = parseFloatOrNull(profitRaw) ?? 0;
    rawProfitSum += profitRaw_;

    const commission        = Math.abs(parseFloatOrNull(commissionRaw) ?? 0) / normFactor;
    const swap              = (parseFloatOrNull(swapRaw) ?? 0) / normFactor;
    const profit            = profitRaw_ / normFactor;
    const balanceAfterTrade = equityVal !== null ? equityVal / normFactor : null;

    normalizedProfitSum += profit;

    // Trade Status
    let status: TradeStatus = "BREAKEVEN";
    if (profit > 0.001) status = "WIN";
    else if (profit < -0.001) status = "LOSS";

    // Risk:Reward Ratio
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
      openTime: openIso,
      closeTime: closeIso,
      symbol: canonicalSymbol,
      direction,
      volume: parseFloat(volume.toFixed(2)),
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
    });
  });

  return {
    trades,
    detectedCurrency: "USD",
    detectedAccountType,
    isCentAccount,
    rawProfitSum: parseFloat(rawProfitSum.toFixed(2)),
    normalizedProfitSum: parseFloat(normalizedProfitSum.toFixed(2)),
    lastKnownBalance,
    errors,
  };
}

/**
 * Generate a deterministic trade fingerprint.
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
