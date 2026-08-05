// lib/supabase/trade-images.ts
// Image management for trade_images table + Supabase Storage.

import { createClient } from './client';
import { isFrontendOnly } from '@/lib/config/frontend-only';
import {
  getFrontendTradeImages,
  uploadFrontendTradeImage,
  deleteFrontendTradeImage,
} from './frontend-store';
import type { TradeImage, TradeImageType, ServiceResult } from '@/types/database';

const BUCKET = 'trade-screenshots';

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchTradeImages(
  tradeId: string
): Promise<ServiceResult<TradeImage[]>> {
  if (isFrontendOnly()) {
    return getFrontendTradeImages(tradeId);
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trade_images')
      .select('*')
      .eq('trade_id', tradeId)
      .order('created_at', { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch images';
    return { data: null, error: message };
  }
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload a trade image to Supabase Storage and create the DB record.
 */
export async function uploadTradeImage(
  tradeId: string,
  userId: string,
  file: File,
  imageType: TradeImageType = 'screenshot',
  caption?: string
): Promise<ServiceResult<TradeImage>> {
  if (isFrontendOnly()) {
    return uploadFrontendTradeImage(tradeId, userId, file, imageType, caption);
  }

  const supabase = createClient();

  // Validate
  if (file.size > 10 * 1024 * 1024) {
    return { data: null, error: 'Image must be smaller than 10MB' };
  }
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    return { data: null, error: 'Supported formats: JPG, PNG, WEBP, GIF' };
  }

  try {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const storagePath = `${userId}/${tradeId}/${imageType}-${Date.now()}.${ext}`;

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) return { data: null, error: uploadError.message };

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    // Insert DB record
    const { data, error } = await supabase
      .from('trade_images')
      .insert({
        user_id: userId,
        trade_id: tradeId,
        image_type: imageType,
        storage_path: storagePath,
        public_url: publicUrl,
        caption: caption ?? null,
        file_size: file.size,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to upload image';
    return { data: null, error: message };
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete a trade image from Storage and remove the DB record.
 */
export async function deleteTradeImage(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  if (isFrontendOnly()) {
    return deleteFrontendTradeImage(id, userId);
  }

  const supabase = createClient();
  try {
    // Get storage path first
    const { data: img, error: fetchErr } = await supabase
      .from('trade_images')
      .select('storage_path')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchErr) return { data: null, error: fetchErr.message };

    // Remove from storage
    if (img?.storage_path) {
      await supabase.storage.from(BUCKET).remove([img.storage_path]);
    }

    // Remove DB record
    const { error } = await supabase
      .from('trade_images')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete image';
    return { data: null, error: message };
  }
}
