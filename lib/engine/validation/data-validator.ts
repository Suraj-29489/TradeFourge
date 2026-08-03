// lib/engine/validation/data-validator.ts
// TradeFourge v3.7.2 — CSV Validation Engine: Step 3 & 5 (Data Validator & Warning Classification)

import { validateAndParseCsv } from "@/lib/engine/validator";
import type { NormalizedTrade, AccountCurrency } from "../types";

export interface RowValidationError {
  rowNumber: number;
  message: string;
  field: string;
}

export interface RowValidationWarning {
  rowNumber?: number;
  message: string;
  type: "unknown_symbol" | "missing_optional" | "old_trades" | "duplicate_ticket";
}

export interface DataValidationResult {
  totalRows: number;
  validRows: number;
  errors: RowValidationError[];
  warnings: RowValidationWarning[];
  criticalErrorCount: number;
  warningCount: number;
  duplicateCount: number;
  parsedTrades: NormalizedTrade[];
  normalizedProfitSum: number;
}

/**
 * Validates parsed trade rows for valid dates, numbers, trade types, lot sizes, and profit values.
 * Differentiates critical blocking errors from warnings.
 */
export function validateCsvDataRows(
  csvText: string,
  accountName: string = "Primary Account",
  accountCurrency: string = "USD"
): DataValidationResult {
  const errors: RowValidationError[] = [];
  const warnings: RowValidationWarning[] = [];

  // Use core engine parser
  const parsed = validateAndParseCsv(csvText, accountName, accountCurrency);

  const trades = parsed.trades || [];
  const totalRows = trades.length;

  if (totalRows === 0) {
    if (parsed.errors && parsed.errors.length > 0) {
      // Map technical errors to human-friendly messages
      parsed.errors.forEach((errStr, idx) => {
        let humanMsg = errStr;
        if (errStr.includes("Unexpected token") || errStr.includes("JSON") || errStr.includes("syntax")) {
          humanMsg = "This CSV appears to be corrupted.";
        } else if (errStr.includes("bounds") || errStr.includes("length")) {
          humanMsg = "Required trade columns are missing.";
        }
        errors.push({
          rowNumber: idx + 1,
          message: humanMsg,
          field: "csv_structure",
        });
      });
    } else {
      errors.push({
        rowNumber: 0,
        message: "No valid trade rows could be extracted from this statement.",
        field: "rows",
      });
    }

    return {
      totalRows: 0,
      validRows: 0,
      errors,
      warnings,
      criticalErrorCount: errors.length,
      warningCount: 0,
      duplicateCount: 0,
      parsedTrades: [],
      normalizedProfitSum: 0,
    };
  }

  let validRowCount = 0;
  let duplicateCount = 0;
  const ticketsSeen = new Set<string>();
  const currentYear = new Date().getFullYear();

  trades.forEach((trade, index) => {
    const rowNum = index + 2; // +1 for 1-indexing, +1 for header line
    let rowHasCriticalError = false;

    // 1. Validate Trade Type / Direction
    if (!trade.direction || (trade.direction !== "LONG" && trade.direction !== "SHORT")) {
      errors.push({
        rowNumber: rowNum,
        message: `Row ${rowNum} contains an invalid trade direction (must be BUY or SELL).`,
        field: "direction",
      });
      rowHasCriticalError = true;
    }

    // 2. Validate Lot Size / Volume
    if (typeof trade.volume !== "number" || isNaN(trade.volume) || trade.volume <= 0) {
      errors.push({
        rowNumber: rowNum,
        message: `Row ${rowNum} contains an invalid trade volume (lot size must be greater than zero).`,
        field: "volume",
      });
      rowHasCriticalError = true;
    }

    // 3. Validate Profit Value
    if (typeof trade.profit !== "number" || isNaN(trade.profit)) {
      errors.push({
        rowNumber: rowNum,
        message: `Row ${rowNum} contains an invalid profit or PnL value.`,
        field: "profit",
      });
      rowHasCriticalError = true;
    }

    // 4. Validate Close Time Date
    if (!trade.closeTime || isNaN(Date.parse(trade.closeTime))) {
      errors.push({
        rowNumber: rowNum,
        message: `Row ${rowNum} contains an unparseable trade close date format.`,
        field: "closeTime",
      });
      rowHasCriticalError = true;
    } else {
      const tradeYear = new Date(trade.closeTime).getFullYear();
      if (tradeYear < currentYear - 5) {
        warnings.push({
          rowNumber: rowNum,
          message: `Row ${rowNum}: Trade close date (${trade.closeTime.substring(0, 10)}) is older than 5 years.`,
          type: "old_trades",
        });
      }
    }

    // 5. Check Symbol Format Warning
    if (!trade.symbol || trade.symbol.trim().length === 0) {
      errors.push({
        rowNumber: rowNum,
        message: `Row ${rowNum} is missing a required trade symbol.`,
        field: "symbol",
      });
      rowHasCriticalError = true;
    } else if (trade.symbol.length > 15 || /[^a-zA-Z0-9#._-]/g.test(trade.symbol)) {
      warnings.push({
        rowNumber: rowNum,
        message: `Row ${rowNum}: Non-standard trade symbol detected ("${trade.symbol}").`,
        type: "unknown_symbol",
      });
    }

    // 6. Duplicate Ticket Warning
    if (trade.ticket) {
      if (ticketsSeen.has(trade.ticket)) {
        duplicateCount++;
        warnings.push({
          rowNumber: rowNum,
          message: `Row ${rowNum}: Duplicate ticket ID detected ("${trade.ticket}").`,
          type: "duplicate_ticket",
        });
      } else {
        ticketsSeen.add(trade.ticket);
      }
    }

    // 7. Check Optional SL/TP Warnings
    if (trade.stopLoss === null && trade.takeProfit === null && index === 0) {
      warnings.push({
        message: "Optional Stop Loss and Take Profit fields are omitted in this statement.",
        type: "missing_optional",
      });
    }

    if (!rowHasCriticalError) {
      validRowCount++;
    }
  });

  return {
    totalRows,
    validRows: validRowCount,
    errors,
    warnings,
    criticalErrorCount: errors.length,
    warningCount: warnings.length,
    duplicateCount,
    parsedTrades: trades,
    normalizedProfitSum: parsed.normalizedTotalProfit || 0,
  };
}
