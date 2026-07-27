// lib/supabase/csv-imports.ts
// Service for tracking CSV import history in the csv_imports table.

import { createClient } from './client';
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

/**
 * Fetch the most recent import (for dashboard widget).
 */
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

/**
 * Create a new import record (called at start of import process).
 * Returns the record ID to be used for subsequent updates.
 */
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
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create import record';
    return { data: null, error: message };
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Update an import record with final stats (called after import completes).
 */
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

    // Mark completion time if status is terminal
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

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteImportRecord(
  id: string,
  userId: string,
  deleteTrades = false
): Promise<ServiceResult<boolean>> {
  const supabase = createClient();
  try {
    if (deleteTrades) {
      await supabase
        .from('trades')
        .delete()
        .eq('import_id', id)
        .eq('user_id', userId);
    }

    const { error } = await supabase
      .from('csv_imports')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete import record';
    return { data: null, error: message };
  }
}
