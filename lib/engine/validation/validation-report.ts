// lib/engine/validation/validation-report.ts
// TradeFourge v3.7.3 — CSV Validation Engine & Deterministic Duplicate Analyzer

import { validateFileContent } from "./file-validator";
import { validateCsvColumns } from "./column-validator";
import { detectBrokerFormat } from "./broker-detector";
import { validateCsvDataRows } from "./data-validator";
import { analyzeInFileDuplicates } from "./fingerprint";
import type { NormalizedTrade, AccountCurrency } from "../types";

export interface ValidationReport {
  totalRows: number;
  validRows: number;
  warningCount: number;
  errorCount: number;
  duplicateCount: number;
  inFileDuplicatesCount: number;
  brokerDetected: string;
  platformDetected: string;
  selectedAccountName: string;
  errors: string[];
  warnings: string[];
  missingColumns: string[];
  isImportAllowed: boolean;
  isCentAccount: boolean;
  normalizedProfitSum: number;
  parsedTrades: NormalizedTrade[];
}

/**
 * Executes full validation pipeline across independent modules:
 * File Validator -> Column Validator -> Broker Detector -> Data Validator -> Fingerprint Engine -> Validation Report.
 */
export function generateValidationReport(
  csvText: string,
  selectedAccountName: string = "Primary Account",
  selectedAccountCurrency: string = "USD",
  accountId: string = "ACC_DEFAULT"
): ValidationReport {
  const errorsList: string[] = [];
  const warningsList: string[] = [];
  let missingCols: string[] = [];

  // Step 1: File Validation
  const fileRes = validateFileContent(csvText);
  if (!fileRes.isValid) {
    return {
      totalRows: 0,
      validRows: 0,
      warningCount: 0,
      errorCount: 1,
      duplicateCount: 0,
      inFileDuplicatesCount: 0,
      brokerDetected: "Unknown",
      platformDetected: "Unrecognized Format",
      selectedAccountName,
      errors: [fileRes.error || "This CSV file appears to be corrupted."],
      warnings: [],
      missingColumns: [],
      isImportAllowed: false,
      isCentAccount: false,
      normalizedProfitSum: 0,
      parsedTrades: [],
    };
  }

  const headerRow = fileRes.lines[0];

  // Step 2: Column Validation
  const colRes = validateCsvColumns(headerRow);
  if (!colRes.isValid) {
    missingCols = colRes.missingColumns;
    errorsList.push(colRes.error || "Required trade columns are missing.");
  }

  // Step 4: Broker Format Detection
  const brokerRes = detectBrokerFormat(csvText, colRes.detectedColumns);
  if (!brokerRes.isSupported && brokerRes.explanation) {
    errorsList.push(brokerRes.explanation);
  }

  // Step 3 & 5: Data Validation
  const dataRes = validateCsvDataRows(csvText, selectedAccountName, selectedAccountCurrency);

  dataRes.errors.forEach((e) => errorsList.push(e.message));
  dataRes.warnings.forEach((w) => warningsList.push(w.message));

  // Step 6: Deterministic Fingerprint Analysis
  const fpRes = analyzeInFileDuplicates(dataRes.parsedTrades, accountId);
  if (fpRes.inFileDuplicatesCount > 0) {
    warningsList.push(`${fpRes.inFileDuplicatesCount} duplicate trade row(s) detected inside this CSV statement.`);
  }

  // Determine if import is allowed
  const isImportAllowed = errorsList.length === 0 && colRes.isValid && brokerRes.isSupported && dataRes.validRows > 0;

  return {
    totalRows: dataRes.totalRows,
    validRows: dataRes.validRows,
    warningCount: warningsList.length,
    errorCount: errorsList.length,
    duplicateCount: dataRes.duplicateCount + fpRes.inFileDuplicatesCount,
    inFileDuplicatesCount: fpRes.inFileDuplicatesCount,
    brokerDetected: brokerRes.broker,
    platformDetected: brokerRes.platformName,
    selectedAccountName,
    errors: errorsList,
    warnings: warningsList,
    missingColumns: missingCols,
    isImportAllowed,
    isCentAccount: selectedAccountCurrency === "USC",
    normalizedProfitSum: dataRes.normalizedProfitSum,
    parsedTrades: dataRes.parsedTrades,
  };
}
