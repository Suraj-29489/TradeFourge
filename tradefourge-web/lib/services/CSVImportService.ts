// lib/services/CSVImportService.ts
// Dedicated Data Layer Service for CSV Imports.

import { createClient } from "@/lib/supabase/client";
import { emitAppEvent } from "@/lib/events/event-bus";
import type { CsvImport, ServiceResult } from "@/types/database";

export class CSVImportService {
  /**
   * Fetch import records for a user.
   */
  static async getImportHistory(userId: string): Promise<ServiceResult<CsvImport[]>> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("csv_imports")
        .select("*, account:trading_accounts(id, account_name, slug, broker, currency)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch import history";
      return { data: null, error: message };
    }
  }

  /**
   * Create a new CSV import record in Supabase.
   */
  static async createImportRecord(
    userId: string,
    filename: string,
    totalRows: number,
    storagePath?: string,
    accountId?: string | null
  ): Promise<ServiceResult<CsvImport>> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("csv_imports")
        .insert({
          user_id: userId,
          account_id: accountId ?? null,
          filename,
          total_rows: totalRows,
          storage_path: storagePath ?? null,
          import_status: "processing",
        })
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      emitAppEvent("tradefourge:import-created", { importId: data.id });
      return { data, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create import record";
      return { data: null, error: message };
    }
  }

  /**
   * Update import record status upon completion.
   */
  static async updateImportRecord(
    importId: string,
    userId: string,
    updates: Partial<CsvImport>
  ): Promise<ServiceResult<CsvImport>> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("csv_imports")
        .update(updates)
        .eq("id", importId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      emitAppEvent("tradefourge:data-changed", { action: "updateImportRecord", importId });
      return { data, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update import record";
      return { data: null, error: message };
    }
  }

  /**
   * Delete an import record and cascaded trades.
   */
  static async deleteImport(importId: string, userId: string): Promise<ServiceResult<boolean>> {
    const supabase = createClient();
    try {
      // First delete associated trades
      await supabase.from("trades").delete().eq("import_id", importId).eq("user_id", userId);
      const { error } = await supabase.from("csv_imports").delete().eq("id", importId).eq("user_id", userId);

      if (error) return { data: false, error: error.message };
      emitAppEvent("tradefourge:import-deleted", { importId });
      return { data: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete import";
      return { data: false, error: message };
    }
  }
}
