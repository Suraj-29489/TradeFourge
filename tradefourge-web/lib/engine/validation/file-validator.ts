// lib/engine/validation/file-validator.ts
// TradeFourge v3.7.1 — CSV Validation Engine: Step 1 (File Validator)

export interface FileValidationResult {
  isValid: boolean;
  error: string | null;
  lines: string[];
}

/**
 * Validates file existence, non-emptiness, readability, and basic line structure.
 */
export function validateFileContent(csvText: string | null | undefined): FileValidationResult {
  if (!csvText || typeof csvText !== "string") {
    return {
      isValid: false,
      error: "No file content detected or file could not be read.",
      lines: [],
    };
  }

  const trimmed = csvText.trim();

  // Step 1: Check empty file
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: "This CSV file appears to be empty.",
      lines: [],
    };
  }

  // Step 2: Check binary / null byte corruption
  if (trimmed.includes("\0")) {
    return {
      isValid: false,
      error: "This file appears to be corrupted or in an unsupported binary format.",
      lines: [],
    };
  }

  // Split into non-empty lines
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      isValid: false,
      error: "This CSV file contains no readable rows of data.",
      lines: [],
    };
  }

  return {
    isValid: true,
    error: null,
    lines,
  };
}
