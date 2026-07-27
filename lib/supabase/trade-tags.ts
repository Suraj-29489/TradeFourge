// lib/supabase/trade-tags.ts
// Tag management service for trade_tags and trade_tag_links tables.

import { createClient } from './client';
import type { TradeTag, NewTradeTag, ServiceResult } from '@/types/database';

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchUserTags(userId: string): Promise<ServiceResult<TradeTag[]>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trade_tags')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch tags';
    return { data: null, error: message };
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createTag(
  userId: string,
  payload: NewTradeTag
): Promise<ServiceResult<TradeTag>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trade_tags')
      .insert({ ...payload, user_id: userId })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create tag';
    return { data: null, error: message };
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteTag(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('trade_tags')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete tag';
    return { data: null, error: message };
  }
}

// ─── Trade-Tag Links ──────────────────────────────────────────────────────────

export async function addTagToTrade(
  tradeId: string,
  tagId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('trade_tag_links')
      .insert({ trade_id: tradeId, tag_id: tagId });

    // Ignore duplicate key errors (idempotent)
    if (error && !error.message.includes('duplicate')) {
      return { data: null, error: error.message };
    }
    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to add tag';
    return { data: null, error: message };
  }
}

export async function removeTagFromTrade(
  tradeId: string,
  tagId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('trade_tag_links')
      .delete()
      .eq('trade_id', tradeId)
      .eq('tag_id', tagId);

    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to remove tag';
    return { data: null, error: message };
  }
}

/**
 * Replace all tags for a trade (used in trade edit form).
 */
export async function setTradeTagIds(
  tradeId: string,
  tagIds: string[]
): Promise<ServiceResult<boolean>> {
  const supabase = createClient();
  try {
    // Delete all existing links
    await supabase.from('trade_tag_links').delete().eq('trade_id', tradeId);

    // Insert new links (if any)
    if (tagIds.length > 0) {
      const { error } = await supabase
        .from('trade_tag_links')
        .insert(tagIds.map((tag_id) => ({ trade_id: tradeId, tag_id })));
      if (error) return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to set trade tags';
    return { data: null, error: message };
  }
}
