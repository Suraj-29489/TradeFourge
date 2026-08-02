// lib/supabase/csv-imports.ts
// Service for tracking CSV upload history in public.csv_imports with cascading delete integrity and dev logging.

import { createClient } from './client';
import { emitAppEvent } from '@/lib/events/event-bus';
import { isFrontendOnly } from '@/lib/config/frontend-only';
import {
  getFrontendImportHistory,
  getFrontendLatestImport,
  createFrontendImportRecord,
  updateFrontendImportRecord,
  deleteFrontendImportRecord,
  deleteAllFrontendImports,
} from './frontend-store';
import type { CsvImport, ServiceResult } from '@/types/database';

export interface DeleteImportResult {
  success: boolean;
  status: "NOT_FOUND" | "FILE_MISSING_DB_REMOVED" | "DELETED_SUCCESS";
  message: string;
  error: string | null;
}

/**
 * Fetch list of CSV imports for user.
 */
export async function fetchImportHistory(
  userId: string
): Promise<ServiceResult<CsvImport[]>> {
  if (isFrontendOnly()) {
    return getFrontendImportHistory(userId);
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('csv_imports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch import history';
    return { data: null, error: message };
  }
}

/**
 * Fetch the single latest import record for user.
 */
export async function fetchLatestImport(
  userId: string
): Promise<ServiceResult<CsvImport | null>> {
  if (isFrontendOnly()) {
    return getFrontendLatestImport(userId);
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('csv_imports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch latest import';
    return { data: null, error: message };
  }
}

/**
 * Create a new import record.
 */
export async function createImportRecord(
  userId: string,
  filename: string,
  totalRows: number,
  storagePath?: string
): Promise<ServiceResult<CsvImport>> {
  if (isFrontendOnly()) {
    return createFrontendImportRecord(userId, filename, totalRows, storagePath);
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('csv_imports')
      .insert({
        user_id: userId,
        filename,
        total_rows: totalRows,
        imported_rows: 0,
        failed_rows: 0,
        skipped_rows: 0,
        import_status: 'processing',
        storage_path: storagePath ?? null,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    emitAppEvent("tradefourge:import-created", { importId: data.id });
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create import record';
    return { data: null, error: message };
  }
}

/**
 * Update an existing import record's stats/status.
 */
export async function updateImportRecord(
  id: string,
  userId: string,
  updates: Partial<CsvImport>
): Promise<ServiceResult<CsvImport>> {
  if (isFrontendOnly()) {
    return updateFrontendImportRecord(id, userId, updates);
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('csv_imports')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update import record';
    return { data: null, error: message };
  }
}

/**
 * Delete single import record with mandatory cascading trade deletion, verification, and dev logging.
 */
export async function deleteImportRecord(
  id: string,
  userId: string,
  deleteTrades = true
): Promise<DeleteImportResult> {
  if (isFrontendOnly()) {
    return deleteFrontendImportRecord(id, userId, deleteTrades);
  }

  const supabase = createClient();
  try {
    // 0. Query rows before
    const { count: tradesBefore } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('import_id', id)
      .eq('user_id', userId);

    const { count: importsBefore } = await supabase
      .from('csv_imports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[TradeFourge Dev Log] Delete Import Request — Target Import ID: ${id}, User ID: ${userId}, Import Trades Before: ${tradesBefore ?? 0}, Imports Before: ${importsBefore ?? 0}`);
    }

    // 1. Verify import record exists
    const { data: existing } = await supabase
      .from('csv_imports')
      .select('id, storage_path')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[TradeFourge Dev Log] Delete Import Warning — Record ${id} not found in DB.`);
      }
      return {
        success: true,
        status: "NOT_FOUND",
        message: "Nothing to delete.",
        error: null,
      };
    }

    // 2. Cascading Trade Delete: Remove all trades belonging to this import with .select('id')
    let deletedTradesCount = 0;
    if (deleteTrades) {
      const { data: deletedTradeRows, error: tradeDelErr } = await supabase
        .from('trades')
        .delete()
        .eq('import_id', id)
        .eq('user_id', userId)
        .select('id');

      if (tradeDelErr) {
        if (process.env.NODE_ENV !== "production") {
          console.error(`[TradeFourge Dev Log] Delete Import Trades Failed — Error: ${tradeDelErr.message}`);
        }
        return {
          success: false,
          status: "NOT_FOUND",
          message: "Failed to delete import trades.",
          error: tradeDelErr.message,
        };
      }
      deletedTradesCount = deletedTradeRows?.length ?? 0;

      // Verify no trades remain for this import ID
      const { count: remainingImportTrades } = await supabase
        .from('trades')
        .select('id', { count: 'exact', head: true })
        .eq('import_id', id)
        .eq('user_id', userId);

      const tradesAfter = remainingImportTrades ?? 0;

      if (tradesAfter > 0) {
        if (process.env.NODE_ENV !== "production") {
          console.error(`[TradeFourge Dev Log] Delete Import Trades Verification Failed — ${tradesAfter} trades still exist for import ${id}`);
        }
        return {
          success: false,
          status: "NOT_FOUND",
          message: "Delete failed. Trades for import still exist in database.",
          error: "Verification failed",
        };
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(`[TradeFourge Dev Log] Delete Import Trades Complete — Trades before: ${tradesBefore ?? 0} ↓ Deleted: ${deletedTradesCount} ↓ Remaining: ${tradesAfter}`);
      }
    }

    // 3. Delete storage file if present
    if (existing.storage_path) {
      try {
        await supabase.storage
          .from('csv-imports')
          .remove([existing.storage_path]);
      } catch {}
    }

    // 4. Delete csv_imports database record with .select('id')
    const { data: deletedImportRows, error: dbErr } = await supabase
      .from('csv_imports')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id');

    if (dbErr || !deletedImportRows || deletedImportRows.length === 0) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[TradeFourge Dev Log] Delete Import Record Failed — Error: ${dbErr?.message || "0 rows deleted"}`);
      }
      return {
        success: false,
        status: "NOT_FOUND",
        message: "Failed to delete import record.",
        error: dbErr?.message || "0 rows deleted",
      };
    }

    // 5. Verification Query: Ensure import record is gone
    const { data: checkImport } = await supabase
      .from('csv_imports')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (checkImport) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[TradeFourge Dev Log] Delete Import Verification Failed — Record ${id} still exists in DB!`);
      }
      return {
        success: false,
        status: "NOT_FOUND",
        message: "Delete failed. Import record still exists in database.",
        error: "Verification failed",
      };
    }

    const { count: importsAfter } = await supabase
      .from('csv_imports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[TradeFourge Dev Log] Delete Import Record Complete — Imports before: ${importsBefore ?? 0} ↓ Deleted: 1 ↓ Remaining: ${importsAfter ?? 0}`);
    }

    emitAppEvent("tradefourge:trade-deleted", { importId: id, count: deletedTradesCount });
    emitAppEvent("tradefourge:import-deleted", { importId: id });
    emitAppEvent("tradefourge:data-changed", { importId: id, action: "deleteImportRecord" });

    return {
      success: true,
      status: "DELETED_SUCCESS",
      message: "Import deleted.",
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete import record';
    return {
      success: false,
      status: "NOT_FOUND",
      message: "Failed to delete.",
      error: message,
    };
  }
}

/**
 * Delete all import records for user with cascading trade deletion, verification, and dev logging.
 */
export async function deleteAllImports(userId: string): Promise<DeleteImportResult> {
  if (isFrontendOnly()) {
    return deleteAllFrontendImports(userId);
  }

  const supabase = createClient();
  try {
    // 0. Query rows before
    const { count: tradesBefore } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: importsBefore } = await supabase
      .from('csv_imports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[TradeFourge Dev Log] Delete All Imports Request — User: ${userId}, Trades Before: ${tradesBefore ?? 0}, Imports Before: ${importsBefore ?? 0}`);
    }

    // 1. Purge all trades for user with .select('id')
    const { data: deletedTradeRows, error: tradeErr } = await supabase
      .from('trades')
      .delete()
      .eq('user_id', userId)
      .select('id');

    if (tradeErr) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[TradeFourge Dev Log] Delete All Imports - Trades Delete Error: ${tradeErr.message}`);
      }
      return {
        success: false,
        status: "NOT_FOUND",
        message: "Failed to purge trades.",
        error: tradeErr.message,
      };
    }

    const deletedTradesCount = deletedTradeRows?.length ?? 0;

    // 2. Purge all import records with .select('id')
    const { data: deletedImportRows, error: deleteErr } = await supabase
      .from('csv_imports')
      .delete()
      .eq('user_id', userId)
      .select('id');

    if (deleteErr) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[TradeFourge Dev Log] Delete All Imports Failed — Error: ${deleteErr.message}`);
      }
      return {
        success: false,
        status: "NOT_FOUND",
        message: "Failed to delete import records.",
        error: deleteErr.message,
      };
    }

    const deletedImportsCount = deletedImportRows?.length ?? 0;

    // 3. Verification Queries: Confirm 0 imports AND 0 trades remain in PostgreSQL
    const { count: remainingImports } = await supabase
      .from('csv_imports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: remainingTrades } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const importsAfter = remainingImports ?? 0;
    const tradesAfter  = remainingTrades ?? 0;

    if (importsAfter > 0 || tradesAfter > 0) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[TradeFourge Dev Log] Delete All Imports Verification Failed — Imports remaining: ${importsAfter}, Trades remaining: ${tradesAfter}`);
      }
      return {
        success: false,
        status: "NOT_FOUND",
        message: `Delete failed. ${tradesAfter} trades and ${importsAfter} imports remain in database.`,
        error: "Verification failed",
      };
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[TradeFourge Dev Log] Delete All Imports Complete — Trades: ${tradesBefore ?? 0} ↓ ${deletedTradesCount} ↓ 0 | Imports: ${importsBefore ?? 0} ↓ ${deletedImportsCount} ↓ 0`);
    }

    emitAppEvent("tradefourge:import-deleted", { all: true });
    emitAppEvent("tradefourge:trade-deleted", { all: true });
    emitAppEvent("tradefourge:data-changed", { all: true, action: "deleteAllImports" });

    return {
      success: true,
      status: "DELETED_SUCCESS",
      message: "All imports and trades deleted.",
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete all imports';
    return {
      success: false,
      status: "NOT_FOUND",
      message: "Failed to delete.",
      error: message,
    };
  }
}
