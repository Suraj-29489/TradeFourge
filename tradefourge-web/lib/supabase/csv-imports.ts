// lib/supabase/csv-imports.ts
// Re-export / Delegate service for tracking CSV upload history in public.csv_imports.
// Delegates to CSVImportService in lib/services/CSVImportService.ts.

import { CSVImportService } from '@/lib/services/CSVImportService';
import type { CsvImport, ServiceResult } from '@/types/database';

export interface DeleteImportResult {
  success: boolean;
  status: "NOT_FOUND" | "FILE_MISSING_DB_REMOVED" | "DELETED_SUCCESS";
  message: string;
  error: string | null;
}

export async function fetchImportHistory(
  userId: string
): Promise<ServiceResult<CsvImport[]>> {
  return CSVImportService.getImportHistory(userId);
}

export async function fetchLatestImport(
  userId: string
): Promise<ServiceResult<CsvImport | null>> {
  const { data, error } = await CSVImportService.getImportHistory(userId);
  if (error) return { data: null, error };
  const latest = data && data.length > 0 ? data[0] : null;
  return { data: latest, error: null };
}

export async function createImportRecord(
  userId: string,
  filename: string,
  totalRows: number,
  storagePath?: string,
  accountId?: string | null
): Promise<ServiceResult<CsvImport>> {
  return CSVImportService.createImportRecord(userId, filename, totalRows, storagePath, accountId);
}

export async function updateImportRecord(
  importId: string,
  userId: string,
  updates: Partial<CsvImport>
): Promise<ServiceResult<CsvImport>> {
  return CSVImportService.updateImportRecord(importId, userId, updates);
}

export async function deleteImportRecord(
  importId: string,
  userId: string,
  deleteTrades?: boolean
): Promise<DeleteImportResult> {
  const res = await CSVImportService.deleteImport(importId, userId, deleteTrades);
  return {
    success: res.data ?? false,
    status: res.data ? "DELETED_SUCCESS" : "NOT_FOUND",
    message: res.data ? "Import deleted successfully" : "Failed to delete import",
    error: res.error,
  };
}

export async function deleteAllImportRecords(
  userId: string
): Promise<DeleteImportResult> {
  const historyRes = await CSVImportService.getImportHistory(userId);
  if (historyRes.data) {
    for (const record of historyRes.data) {
      await CSVImportService.deleteImport(record.id, userId);
    }
  }
  return {
    success: true,
    status: "DELETED_SUCCESS",
    message: "All imports deleted successfully",
    error: null,
  };
}

export const deleteAllImports = deleteAllImportRecords;
