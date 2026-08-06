// lib/supabase/journals.ts
// Service for managing trade_journals in Supabase with RLS user isolation.

import { createClient } from './client';
import { emitAppEvent } from '@/lib/events/event-bus';
import type {
  TradeJournal,
  NewTradeJournal,
  UpdateTradeJournal,
  ServiceResult,
} from '@/types/database';

export interface TradeJournalFilters {
  search?: string;
  category?: string;
  mood?: string;
  tag?: string;
  tradeId?: string;
}

/**
 * Fetch list of trade journals for user from Supabase.
 */
export async function fetchTradeJournals(
  userId: string,
  filters: TradeJournalFilters = {}
): Promise<ServiceResult<TradeJournal[]>> {
  const supabase = createClient();
  try {
    let query = supabase
      .from('trade_journals')
      .select('*, trade:trades(id, symbol, side, net_profit, outcome, close_time)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters.category && filters.category !== 'ALL') {
      query = query.eq('category', filters.category);
    }

    if (filters.mood && filters.mood !== 'ALL') {
      query = query.eq('mood', filters.mood);
    }

    if (filters.tradeId && filters.tradeId !== 'ALL') {
      query = query.eq('trade_id', filters.tradeId);
    }

    if (filters.tag && filters.tag !== 'ALL') {
      query = query.contains('tags', [filters.tag]);
    }

    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim();
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,category.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };

    return { data: data ?? [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch trade journals';
    return { data: null, error: message };
  }
}

/**
 * Fetch trade journals specifically linked to a trade ID.
 */
export async function fetchJournalsByTradeId(
  userId: string,
  tradeId: string
): Promise<ServiceResult<TradeJournal[]>> {
  return fetchTradeJournals(userId, { tradeId });
}

/**
 * Create a new trade journal entry in Supabase.
 */
export async function createTradeJournal(
  userId: string,
  payload: NewTradeJournal
): Promise<ServiceResult<TradeJournal>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trade_journals')
      .insert({
        ...payload,
        user_id: userId,
      })
      .select('*, trade:trades(id, symbol, side, net_profit, outcome, close_time)')
      .single();

    if (error) return { data: null, error: error.message };

    emitAppEvent('tradefourge:data-changed', { action: 'journal-created' });
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create trade journal';
    return { data: null, error: message };
  }
}

/**
 * Update an existing trade journal entry.
 */
export async function updateTradeJournal(
  journalId: string,
  userId: string,
  payload: UpdateTradeJournal
): Promise<ServiceResult<TradeJournal>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trade_journals')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', journalId)
      .eq('user_id', userId)
      .select('*, trade:trades(id, symbol, side, net_profit, outcome, close_time)')
      .single();

    if (error) return { data: null, error: error.message };

    emitAppEvent('tradefourge:data-changed', { action: 'journal-updated' });
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update trade journal';
    return { data: null, error: message };
  }
}

/**
 * Delete a trade journal entry from Supabase.
 */
export async function deleteTradeJournal(
  journalId: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('trade_journals')
      .delete()
      .eq('id', journalId)
      .eq('user_id', userId);

    if (error) return { data: false, error: error.message };

    emitAppEvent('tradefourge:data-changed', { action: 'journal-deleted' });
    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete trade journal';
    return { data: false, error: message };
  }
}
