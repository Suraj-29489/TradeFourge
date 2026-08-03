// lib/engine/validation/column-validator.ts
// TradeFourge v3.7.3 — CSV Validation Engine: Step 2 & Flexible Column Alias Mapping

export interface ColumnValidationResult {
  isValid: boolean;
  missingColumns: string[];
  detectedColumns: string[];
  error: string | null;
  columnMap: Record<string, string>; // Maps canonical field -> detected header name
}

/**
 * Extensible mandatory canonical fields and their comprehensive broker column aliases.
 * Supports MT4, MT5, Exness, FTMO, IC Markets, cTrader, TradeLocker, and custom CSV formats.
 */
export const MANDATORY_FIELD_ALIASES: Record<string, string[]> = {
  Symbol: ["symbol", "item", "pair", "instrument", "asset", "ticker", "currency pair"],
  "Trade Type / Side": ["type", "side", "direction", "action", "cmd", "order type font", "order type", "trade type", "position type", "b/s"],
  "Volume / Size": ["volume", "size", "lots", "amount", "quantity", "lot size", "position size", "contracts"],
  "Close Time": ["close time", "close_time", "time", "date", "closed", "exit time", "close date", "time closed", "exit date"],
  Profit: ["profit", "pnl", "net profit", "closed profit", "realized pnl", "gain", "profit/loss", "realized profit"],
};

/**
 * Optional column aliases for enhanced tracking.
 */
export const OPTIONAL_FIELD_ALIASES: Record<string, string[]> = {
  Ticket: ["ticket", "order", "position", "deal", "position id", "ticket #", "order id", "deal id", "trade id"],
  "Open Time": ["open time", "open_time", "time open", "date open", "entry time", "opened", "open date", "entry date"],
  "Stop Loss": ["s/l", "sl", "stop loss", "stop_loss", "stoploss"],
  "Take Profit": ["t/p", "tp", "take profit", "take_profit", "takeprofit"],
  Commission: ["commission", "comm", "fees", "fee"],
  Swap: ["swap", "rollover", "interest"],
};

/**
 * Normalizes header string for comparison
 */
function cleanHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Flexible Column Mapper: Validates header row against canonical trade fields using fuzzy alias matching.
 */
export function validateCsvColumns(headerRow: string, delimiter: string = ","): ColumnValidationResult {
  if (!headerRow || !headerRow.trim()) {
    return {
      isValid: false,
      missingColumns: ["Symbol", "Trade Type / Side", "Volume / Size", "Close Time", "Profit"],
      detectedColumns: [],
      error: "Required trade columns are missing.",
      columnMap: {},
    };
  }

  // Auto-detect delimiter if necessary
  let sep = delimiter;
  if (!headerRow.includes(",") && headerRow.includes(";")) sep = ";";
  if (!headerRow.includes(",") && !headerRow.includes(";") && headerRow.includes("\t")) sep = "\t";

  // Parse header items
  const headers = headerRow
    .split(sep)
    .map((h) => h.replace(/^["']|["']$/g, "").trim())
    .filter(Boolean);

  const cleanedHeaders = headers.map(cleanHeader);

  const missingColumns: string[] = [];
  const columnMap: Record<string, string> = {};

  for (const [fieldName, aliases] of Object.entries(MANDATORY_FIELD_ALIASES)) {
    const cleanedAliases = aliases.map(cleanHeader);
    let matchedHeader: string | null = null;

    for (let i = 0; i < cleanedHeaders.length; i++) {
      const h = cleanedHeaders[i];
      if (cleanedAliases.some((alias) => h === alias || h.includes(alias) || alias.includes(h))) {
        matchedHeader = headers[i];
        break;
      }
    }

    if (matchedHeader) {
      columnMap[fieldName] = matchedHeader;
    } else {
      missingColumns.push(fieldName);
    }
  }

  // Match optional fields
  for (const [fieldName, aliases] of Object.entries(OPTIONAL_FIELD_ALIASES)) {
    const cleanedAliases = aliases.map(cleanHeader);
    for (let i = 0; i < cleanedHeaders.length; i++) {
      const h = cleanedHeaders[i];
      if (cleanedAliases.some((alias) => h === alias || h.includes(alias) || alias.includes(h))) {
        columnMap[fieldName] = headers[i];
        break;
      }
    }
  }

  if (missingColumns.length > 0) {
    return {
      isValid: false,
      missingColumns,
      detectedColumns: headers,
      error: `Missing mandatory trade columns: ${missingColumns.join(", ")}.`,
      columnMap,
    };
  }

  return {
    isValid: true,
    missingColumns: [],
    detectedColumns: headers,
    error: null,
    columnMap,
  };
}
