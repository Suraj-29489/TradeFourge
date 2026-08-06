// lib/services/JournalService.ts
// Dedicated Data Layer Service for Trade Journals.

import { createClient } from "@/lib/supabase/client";
import { emitAppEvent } from "@/lib/events/event-bus";
import { ensureOrCreateTags } from "@/lib/supabase/trade-tags";
import type {
  TradeJournal,
  NewTradeJournal,
  UpdateTradeJournal,
  ServiceResult,
} from "@/types/database";

export interface JournalQueryFilters {
  search?: string;
  category?: string;
  mood?: string;
  tag?: string;
  tradeId?: string;
  accountId?: string;
}

export class JournalService {
  /**
   * Fetch list of trade journals for user from Supabase.
   */
  static async getJournals(
    userId: string,
    filters: JournalQueryFilters = {}
  ): Promise<ServiceResult<TradeJournal[]>> {
    const supabase = createClient();
    try {
      let query = supabase
        .from("trade_journals")
        .select("*, trade:trades(id, symbol, side, net_profit, outcome, close_time)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (filters.category && filters.category !== "ALL") {
        query = query.eq("category", filters.category);
      }

      if (filters.mood && filters.mood !== "ALL") {
        query = query.eq("mood", filters.mood);
      }

      if (filters.tradeId && filters.tradeId !== "ALL") {
        query = query.eq("trade_id", filters.tradeId);
      }

      if (filters.accountId && filters.accountId !== "ALL") {
        query = query.eq("account_id", filters.accountId);
      }

      if (filters.tag && filters.tag !== "ALL") {
        query = query.contains("tags", [filters.tag]);
      }

      if (filters.search && filters.search.trim() !== "") {
        const q = filters.search.trim();
        query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,category.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[JournalService] getJournals error:", error);
        return { data: null, error: error.message };
      }

      return { data: data ?? [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch trade journals";
      return { data: null, error: message };
    }
  }

  /**
   * Fetch trade journals linked to a specific trade.
   */
  static async getJournalsByTradeId(
    userId: string,
    tradeId: string
  ): Promise<ServiceResult<TradeJournal[]>> {
    return JournalService.getJournals(userId, { tradeId });
  }

  /**
   * Create a new trade journal entry in Supabase.
   */
  static async createJournal(
    userId: string,
    payload: NewTradeJournal
  ): Promise<ServiceResult<TradeJournal>> {
    const supabase = createClient();
    try {
      const sanitizedTags = (payload.tags || [])
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20);

      if (sanitizedTags.length > 0) {
        await ensureOrCreateTags(userId, sanitizedTags);
      }

      const { data, error } = await supabase
        .from("trade_journals")
        .insert({
          ...payload,
          tags: sanitizedTags,
          user_id: userId,
        })
        .select("*, trade:trades(id, symbol, side, net_profit, outcome, close_time)")
        .single();

      if (error) {
        console.error("[JournalService] createJournal error:", error);
        return { data: null, error: error.message };
      }

      emitAppEvent("tradefourge:data-changed", { action: "journal-created", journalId: data.id });
      return { data, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create trade journal";
      return { data: null, error: message };
    }
  }

  /**
   * Update an existing trade journal entry.
   */
  static async updateJournal(
    journalId: string,
    userId: string,
    payload: UpdateTradeJournal
  ): Promise<ServiceResult<TradeJournal>> {
    const supabase = createClient();
    try {
      const updateData: Record<string, any> = {
        ...payload,
        updated_at: new Date().toISOString(),
      };

      if (payload.tags) {
        const sanitizedTags = payload.tags.map((t) => t.trim()).filter(Boolean).slice(0, 20);
        updateData.tags = sanitizedTags;
        if (sanitizedTags.length > 0) {
          await ensureOrCreateTags(userId, sanitizedTags);
        }
      }

      const { data, error } = await supabase
        .from("trade_journals")
        .update(updateData)
        .eq("id", journalId)
        .eq("user_id", userId)
        .select("*, trade:trades(id, symbol, side, net_profit, outcome, close_time)")
        .single();

      if (error) return { data: null, error: error.message };

      emitAppEvent("tradefourge:data-changed", { action: "journal-updated", journalId: data.id });
      return { data, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update trade journal";
      return { data: null, error: message };
    }
  }

  /**
   * Delete a trade journal entry from Supabase.
   */
  static async deleteJournal(
    journalId: string,
    userId: string
  ): Promise<ServiceResult<boolean>> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("trade_journals")
        .delete()
        .eq("id", journalId)
        .eq("user_id", userId);

      if (error) return { data: false, error: error.message };

      emitAppEvent("tradefourge:data-changed", { action: "journal-deleted", journalId });
      return { data: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete trade journal";
      return { data: false, error: message };
    }
  }
}
