// lib/supabase/csv-imports.ts
// Service for tracking CSV import history in the csv_imports table with domain events.

import { createClient } from './client';
import { emitAppEvent } from '@/lib/events/event-bus';
import type { CsvImport, NewCsvImport, UpdateCsvImport, ServiceResult } from '@/types/database';

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchImportHistory(
  userId: string,
  limit = 50
): Promise<ServiceResult<CsvImport[]>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('csv_imports')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
      .limit(limit);

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch import history';
    return { data: null, error: message };
  }
}

export async function fetchImportById(
  id: string,
  userId: string
): Promise<ServiceResult<CsvImport>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('csv_imports')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch import';
    return { data: null, error: message };
  }
}

export async function fetchLatestImport(
  userId: string
): Promise<ServiceResult<CsvImport>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('csv_imports')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return { data: null, error: error.message };
    }
    return { data: data ?? null, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch latest import';
    return { data: null, error: message };
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createImportRecord(
  userId: string,
  payload: Omit<NewCsvImport, 'import_status'> & { import_status?: NewCsvImport['import_status'] }
): Promise<ServiceResult<CsvImport>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('csv_imports')
      .insert({
        ...payload,
        user_id: userId,
        import_status: payload.import_status ?? 'pending',
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

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateImportRecord(
  id: string,
  userId: string,
  updates: UpdateCsvImport
): Promise<ServiceResult<CsvImport>> {
  const supabase = createClient();
  try {
    const payload: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (
      updates.import_status &&
      ['success', 'partial', 'failed'].includes(updates.import_status)
    ) {
      payload.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('csv_imports')
      .update(payload)
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

// ─── Delete Operations ────────────────────────────────────────────────────────

export interface DeleteImportResult {
  success: boolean;
  status: "NOT_FOUND" | "FILE_MISSING_DB_REMOVED" | "DELETED_SUCCESS";
  message: string;
  error: string | null;
}

export async function deleteImportRecord(
  id: string,
  userId: string,
  deleteTrades = true
): Promise<DeleteImportResult> {
  const supabase = createClient();
  try {
    const { data: existing } = await supabase
      .from('csv_imports')
      .select('id, storage_path')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return {
        success: true,
        status: "NOT_FOUND",
        message: "Nothing to delete.",
        error: null,
      };
    }

    if (deleteTrades) {
      try {
        await supabase
          .from('trades')
          .delete()
          .eq('import_id', id)
          .eq('user_id', userId);
        emitAppEvent("tradefourge:trade-deleted", { importId: id });
      } catch {}
    }

    if (existing.storage_path) {
      try {
        await supabase.storage
          .from('csv-imports')
          .remove([existing.storage_path]);
      } catch {}
    }

    const { error: dbErr } = await supabase
      .from('csv_imports')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (dbErr) {
      return {
        success: false,
        status: "NOT_FOUND",
        message: "Failed to delete.",
        error: dbErr.message,
      };
    }

    emitAppEvent("tradefourge:import-deleted", { importId: id });

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
 * Purge all import history records and linked trades for a user.
 */
export async function deleteAllImports(userId: string): Promise<DeleteImportResult> {
  const supabase = createClient();
  try {
    const { data: existingImports } = await supabase
      .from('csv_imports')
      .select('id')
      .eq('user_id', userId);

    if (!existingImports || existingImports.length === 0) {
      return {
        success: true,
        status: "NOT_FOUND",
        message: "Nothing to delete.",
        error: null,
      };
    }

    // 1. Purge all trades linked to imports
    await supabase
      .from('trades')
      .delete()
      .not('import_id', 'is', null)
      .eq('user_id', userId);

    // 2. Purge all import records
    const { error: deleteErr } = await supabase
      .from('csv_imports')
      .delete()
      .eq('user_id', userId);

    if (deleteErr) {
      return {
        success: false,
        status: "NOT_FOUND",
        message: "Failed to delete.",
        error: deleteErr.message,
      };
    }

    emitAppEvent("tradefourge:import-deleted", { all: true });
    emitAppEvent("tradefourge:trade-deleted", { all: true });

    return {
      success: true,
      status: "DELETED_SUCCESS",
      message: "All imports deleted.",
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
