// lib/supabase/accounts.ts
// CRUD service for trading_accounts table.
// All writes validate user_id ownership server-side via RLS.
// Never trust client-provided user_id — always use auth.uid() from RLS.

import { createClient } from './client';
import { isFrontendOnly } from '@/lib/config/frontend-only';
import {
  getFrontendTradingAccounts,
  getFrontendTradingAccountById,
  getFrontendDefaultAccount,
  createFrontendTradingAccount,
  updateFrontendTradingAccount,
  setFrontendDefaultAccount,
  deleteFrontendTradingAccount,
} from './frontend-store';
import type {
  TradingAccount,
  NewTradingAccount,
  UpdateTradingAccount,
  ServiceResult,
} from '@/types/database';

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch all trading accounts for the authenticated user.
 * Default account is returned first, then by creation date.
 */
export async function fetchTradingAccounts(
  userId: string
): Promise<ServiceResult<TradingAccount[]>> {
  if (isFrontendOnly()) {
    return getFrontendTradingAccounts(userId);
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch accounts';
    return { data: null, error: message };
  }
}

/**
 * Fetch a single trading account by ID.
 */
export async function fetchTradingAccountById(
  id: string,
  userId: string
): Promise<ServiceResult<TradingAccount>> {
  if (isFrontendOnly()) {
    return getFrontendTradingAccountById(id, userId);
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch account';
    return { data: null, error: message };
  }
}

/**
 * Fetch the default trading account for a user.
 */
export async function fetchDefaultAccount(
  userId: string
): Promise<ServiceResult<TradingAccount>> {
  if (isFrontendOnly()) {
    return getFrontendDefaultAccount(userId);
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      return { data: null, error: error.message };
    }
    return { data: data ?? null, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch default account';
    return { data: null, error: message };
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Create a new trading account.
 * If is_default is true, unsets all other defaults first.
 */
export async function createTradingAccount(
  userId: string,
  payload: NewTradingAccount
): Promise<ServiceResult<TradingAccount>> {
  if (isFrontendOnly()) {
    return createFrontendTradingAccount(userId, payload);
  }

  const supabase = createClient();
  try {
    // Check for duplicate account name per user (ignore case & leading/trailing spaces)
    const { data: existingAccounts } = await supabase
      .from('trading_accounts')
      .select('id, account_name')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (
      existingAccounts &&
      existingAccounts.some(
        (a: { id: string; account_name: string }) =>
          a.account_name.trim().toLowerCase() === payload.account_name.trim().toLowerCase()
      )
    ) {
      return {
        data: null,
        error: "This account name already exists. Please choose a different name.",
      };
    }

    const { data, error } = await supabase
      .from('trading_accounts')
      .insert({ ...payload, user_id: userId, is_default: false })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create account';
    return { data: null, error: message };
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Update an existing trading account.
 * Ownership is enforced by RLS + the user_id check in the query.
 */
export async function updateTradingAccount(
  id: string,
  userId: string,
  updates: UpdateTradingAccount
): Promise<ServiceResult<TradingAccount>> {
  if (isFrontendOnly()) {
    return updateFrontendTradingAccount(id, userId, updates);
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trading_accounts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update account';
    return { data: null, error: message };
  }
}

/**
 * Set one account as the default, clearing all others.
 */
export async function setDefaultAccount(
  id: string,
  userId: string
): Promise<ServiceResult<TradingAccount>> {
  if (isFrontendOnly()) {
    return setFrontendDefaultAccount(id, userId);
  }

  const supabase = createClient();
  try {
    // Clear all defaults
    await supabase
      .from('trading_accounts')
      .update({ is_default: false })
      .eq('user_id', userId);

    // Set new default
    const { data, error } = await supabase
      .from('trading_accounts')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to set default account';
    return { data: null, error: message };
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Soft-delete (deactivate) a trading account.
 * Hard delete is not used — trades referencing this account use ON DELETE SET NULL.
 */
export async function deleteTradingAccount(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  if (isFrontendOnly()) {
    return deleteFrontendTradingAccount(id, userId);
  }

  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('trading_accounts')
      .update({ is_active: false, is_default: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete account';
    return { data: null, error: message };
  }
}
