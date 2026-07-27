// lib/supabase/trade-checklists.ts
// Checklist template management and per-trade completion tracking.

import { createClient } from './client';
import type {
  TradeChecklist,
  TradeChecklistItem,
  TradeChecklistCompletion,
  ServiceResult,
} from '@/types/database';

// ─── Checklists ───────────────────────────────────────────────────────────────

export async function fetchChecklists(userId: string): Promise<ServiceResult<TradeChecklist[]>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trade_checklists')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch checklists';
    return { data: null, error: message };
  }
}

export async function createChecklist(
  userId: string,
  name: string,
  description?: string
): Promise<ServiceResult<TradeChecklist>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trade_checklists')
      .insert({ user_id: userId, name, description: description ?? null })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create checklist';
    return { data: null, error: message };
  }
}

export async function deleteChecklist(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('trade_checklists')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete checklist';
    return { data: null, error: message };
  }
}

// ─── Checklist Items ──────────────────────────────────────────────────────────

export async function fetchChecklistItems(
  checklistId: string
): Promise<ServiceResult<TradeChecklistItem[]>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trade_checklist_items')
      .select('*')
      .eq('checklist_id', checklistId)
      .order('sort_order', { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch checklist items';
    return { data: null, error: message };
  }
}

export async function addChecklistItem(
  checklistId: string,
  text: string,
  sortOrder = 0
): Promise<ServiceResult<TradeChecklistItem>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trade_checklist_items')
      .insert({ checklist_id: checklistId, text, sort_order: sortOrder })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to add checklist item';
    return { data: null, error: message };
  }
}

export async function deleteChecklistItem(id: string): Promise<ServiceResult<boolean>> {
  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('trade_checklist_items')
      .delete()
      .eq('id', id);

    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete item';
    return { data: null, error: message };
  }
}

// ─── Completions ──────────────────────────────────────────────────────────────

export async function fetchTradeChecklistCompletions(
  tradeId: string
): Promise<ServiceResult<TradeChecklistCompletion[]>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trade_checklist_completions')
      .select('*')
      .eq('trade_id', tradeId);

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch completions';
    return { data: null, error: message };
  }
}

/**
 * Save checklist completions for a trade (upsert — idempotent).
 */
export async function saveTradeChecklistCompletions(
  tradeId: string,
  completions: { checklist_item_id: string; is_checked: boolean }[]
): Promise<ServiceResult<boolean>> {
  const supabase = createClient();
  try {
    const rows = completions.map((c) => ({
      trade_id: tradeId,
      checklist_item_id: c.checklist_item_id,
      is_checked: c.is_checked,
    }));

    const { error } = await supabase
      .from('trade_checklist_completions')
      .upsert(rows, { onConflict: 'trade_id,checklist_item_id' });

    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save completions';
    return { data: null, error: message };
  }
}
