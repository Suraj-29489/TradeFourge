// lib/supabase/trade-tags.ts
// Tag management service for trade_tags and trade_tag_links tables.

import { createClient } from './client';
import { isFrontendOnly } from '@/lib/config/frontend-only';
import {
  getFrontendTradeTags,
  createFrontendTag,
  deleteFrontendTag,
} from './frontend-store';
import type { TradeTag, NewTradeTag, ServiceResult } from '@/types/database';

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchUserTags(userId: string): Promise<ServiceResult<TradeTag[]>> {
  if (isFrontendOnly()) {
    return getFrontendTradeTags(userId);
  }

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
  if (isFrontendOnly()) {
    return createFrontendTag(userId, payload);
  }

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

/**
 * Ensure array of tag names exist in trade_tags table for user.
 * Normalizes tag names (case-insensitive) to prevent duplicate tag records.
 */
export async function ensureOrCreateTags(
  userId: string,
  tagNames: string[]
): Promise<ServiceResult<TradeTag[]>> {
  if (isFrontendOnly()) {
    return fetchUserTags(userId);
  }

  const supabase = createClient();
  try {
    const normalizedNames = Array.from(
      new Set(tagNames.map((t) => t.trim()).filter(Boolean))
    );

    if (normalizedNames.length === 0) {
      return { data: [], error: null };
    }

    // Fetch existing user tags
    const { data: existingTags, error: fetchErr } = await supabase
      .from('trade_tags')
      .select('*')
      .eq('user_id', userId);

    if (fetchErr) return { data: null, error: fetchErr.message };

    const existingMap = new Map<string, TradeTag>();
    (existingTags || []).forEach((t: TradeTag) => {
      existingMap.set(t.name.toLowerCase(), t);
    });

    const resultTags: TradeTag[] = [];
    const missingNames: string[] = [];

    for (const name of normalizedNames) {
      const lower = name.toLowerCase();
      if (existingMap.has(lower)) {
        resultTags.push(existingMap.get(lower)!);
      } else {
        missingNames.push(name);
      }
    }

    if (missingNames.length > 0) {
      const newRows = missingNames.map((name) => ({
        user_id: userId,
        name,
        color: '#3b82f6',
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from('trade_tags')
        .insert(newRows)
        .select();

      if (!insertErr && inserted) {
        resultTags.push(...inserted);
      }
    }

    return { data: resultTags, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to ensure tags';
    return { data: null, error: message };
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteTag(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  if (isFrontendOnly()) {
    return deleteFrontendTag(id, userId);
  }

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
  if (isFrontendOnly()) {
    return { data: true, error: null };
  }

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
  if (isFrontendOnly()) {
    return { data: true, error: null };
  }

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
  if (isFrontendOnly()) {
    return { data: true, error: null };
  }

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
