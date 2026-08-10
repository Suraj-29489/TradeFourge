// lib/services/AccountService.ts
// Dedicated Data Layer Service for Trading Accounts.
// Dual-layer persistent storage (Supabase PostgreSQL + localStorage backup).

import { createClient } from "@/lib/supabase/client";
import { emitAppEvent } from "@/lib/events/event-bus";
import { generateAccountSlug, isAccountSlugUnique } from "@/lib/account/account-identity";
import {
  generateDisplayAccountId,
  getFrontendTradingAccounts,
  createFrontendTradingAccount,
  updateFrontendTradingAccount,
  deleteFrontendTradingAccount,
  saveUserAccountsToLocalStorage,
  loadUserAccountsFromLocalStorage,
} from "@/lib/supabase/frontend-store";
import type {
  TradingAccount,
  NewTradingAccount,
  UpdateTradingAccount,
  ServiceResult,
} from "@/types/database";

export class AccountService {
  /**
   * Fetch all active trading accounts for a user.
   * Tries Supabase first; merges and falls back to localStorage.
   */
  static async getAccounts(userId: string): Promise<ServiceResult<TradingAccount[]>> {
    const supabase = createClient();
    const localAccounts = loadUserAccountsFromLocalStorage(userId).filter((a) => a.is_active !== false);

    try {
      const { data, error } = await supabase
        .from("trading_accounts")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        if (localAccounts.length > 0) {
          return { data: localAccounts, error: null };
        }
        if (error) return { data: localAccounts, error: null };
      }

      // Merge local and remote accounts without duplicates
      const mergedMap = new Map<string, TradingAccount>();
      localAccounts.forEach((a) => mergedMap.set(a.id || String(a.account_number), a));
      (data || []).forEach((a: TradingAccount) => mergedMap.set(a.id || String(a.account_number), a));

      const mergedList = Array.from(mergedMap.values());
      saveUserAccountsToLocalStorage(userId, mergedList);
      return { data: mergedList, error: null };
    } catch (err: unknown) {
      return { data: localAccounts, error: null };
    }
  }

  /**
   * Fetch a single trading account by ID.
   */
  static async getAccountById(id: string, userId: string): Promise<ServiceResult<TradingAccount>> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("trading_accounts")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        const localAccounts = loadUserAccountsFromLocalStorage(userId);
        const found = localAccounts.find((a) => a.id === id || String(a.account_number) === id);
        return { data: found ?? null, error: found ? null : "Account not found" };
      }
      return { data, error: null };
    } catch (err: unknown) {
      const localAccounts = loadUserAccountsFromLocalStorage(userId);
      const found = localAccounts.find((a) => a.id === id || String(a.account_number) === id);
      return { data: found ?? null, error: found ? null : "Account not found" };
    }
  }

  /**
   * Create a new trading account.
   * Always persists to BOTH Supabase and localStorage.
   */
  static async createAccount(
    userId: string,
    payload: NewTradingAccount
  ): Promise<ServiceResult<TradingAccount>> {
    const supabase = createClient();
    const slug = generateAccountSlug(payload.account_name);

    // Check existing accounts locally + remotely to prevent duplicate identity
    const existingAccounts = loadUserAccountsFromLocalStorage(userId).filter((a) => a.is_active !== false);
    
    // Identity matching by account_number + broker + server
    const cleanNum = String(payload.account_number || "").replace(/\D/g, "");
    if (cleanNum) {
      const duplicateAcc = existingAccounts.find(
        (a) => String(a.account_number).replace(/\D/g, "") === cleanNum &&
          a.broker.toLowerCase() === (payload.broker || "").toLowerCase()
      );
      if (duplicateAcc) {
        console.log(`[AccountService] Account #${cleanNum} already exists in workspace.`);
        return { data: duplicateAcc, error: null };
      }
    }

    if (!isAccountSlugUnique(slug, existingAccounts)) {
      return {
        data: null,
        error: "An account with this name already exists.",
      };
    }

    const displayId = payload.display_id || generateDisplayAccountId();
    const isDefault = payload.is_default ?? (existingAccounts.length === 0);
    const internalId = `acc_${cleanNum || Date.now()}`;

    const newAccountPayload: TradingAccount = {
      id: internalId,
      user_id: userId,
      display_id: displayId,
      slug,
      account_name: payload.account_name,
      broker: payload.broker,
      platform: payload.platform ?? null,
      account_number: payload.account_number || displayId,
      account_type: payload.account_type ?? null,
      currency: payload.currency ?? null,
      server: payload.server ?? null,
      leverage: payload.leverage ? String(payload.leverage) : null,
      starting_balance: payload.starting_balance ?? null,
      current_balance: payload.current_balance ?? payload.starting_balance ?? null,
      is_default: isDefault,
      is_active: true,
      notes: payload.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Save locally first (guaranteed persistence)
    const updatedLocal = [newAccountPayload, ...existingAccounts.filter((a) => a.id !== internalId)];
    saveUserAccountsToLocalStorage(userId, updatedLocal);

    // 2. Save to Supabase DB asynchronously if available
    try {
      const { data: dbData, error } = await supabase
        .from("trading_accounts")
        .insert({
          ...payload,
          user_id: userId,
          slug,
          display_id: displayId,
          account_number: payload.account_number || displayId,
          is_default: isDefault,
          is_active: true,
        })
        .select()
        .single();

      if (dbData) {
        saveUserAccountsToLocalStorage(userId, [dbData, ...updatedLocal.filter((a) => a.id !== dbData.id)]);
        emitAppEvent("tradefourge:account-created", { accountId: dbData.id });
        return { data: dbData, error: null };
      }
    } catch (err) {
      console.warn("[AccountService] Supabase insert note, saved to localStorage fallback:", err);
    }

    emitAppEvent("tradefourge:account-created", { accountId: newAccountPayload.id });
    return { data: newAccountPayload, error: null };
  }

  /**
   * Update an existing trading account.
   */
  static async updateAccount(
    id: string,
    userId: string,
    updates: UpdateTradingAccount
  ): Promise<ServiceResult<TradingAccount>> {
    const supabase = createClient();
    let localAccounts = loadUserAccountsFromLocalStorage(userId);
    const index = localAccounts.findIndex((a) => a.id === id);

    if (index !== -1) {
      localAccounts[index] = {
        ...localAccounts[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      saveUserAccountsToLocalStorage(userId, localAccounts);
    }

    try {
      const { data, error } = await supabase
        .from("trading_accounts")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (data) {
        emitAppEvent("tradefourge:account-updated", { accountId: data.id });
        return { data, error: null };
      }
    } catch (err) {}

    const updated = localAccounts[index] ?? null;
    if (updated) emitAppEvent("tradefourge:account-updated", { accountId: updated.id });
    return { data: updated, error: updated ? null : "Account not found" };
  }

  /**
   * Delete (soft delete) a trading account.
   */
  static async deleteAccount(id: string, userId: string): Promise<ServiceResult<boolean>> {
    const supabase = createClient();
    let localAccounts = loadUserAccountsFromLocalStorage(userId);
    const filtered = localAccounts.filter((a) => a.id !== id);
    saveUserAccountsToLocalStorage(userId, filtered);

    try {
      await supabase
        .from("trading_accounts")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
    } catch (err) {}

    emitAppEvent("tradefourge:account-deleted", { accountId: id });
    return { data: true, error: null };
  }
}
