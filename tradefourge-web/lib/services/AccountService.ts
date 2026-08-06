// lib/services/AccountService.ts
// Dedicated Data Layer Service for Trading Accounts.

import { createClient } from "@/lib/supabase/client";
import { emitAppEvent } from "@/lib/events/event-bus";
import { generateAccountSlug, isAccountSlugUnique } from "@/lib/account/account-identity";
import { generateDisplayAccountId } from "@/lib/supabase/frontend-store";
import type {
  TradingAccount,
  NewTradingAccount,
  UpdateTradingAccount,
  ServiceResult,
} from "@/types/database";

export class AccountService {
  /**
   * Fetch all active trading accounts for a user.
   */
  static async getAccounts(userId: string): Promise<ServiceResult<TradingAccount[]>> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("trading_accounts")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch accounts";
      return { data: null, error: message };
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

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch account";
      return { data: null, error: message };
    }
  }

  /**
   * Create a new trading account in Supabase.
   * Ensures immutable display_id generation and slug uniqueness per user.
   */
  static async createAccount(
    userId: string,
    payload: NewTradingAccount
  ): Promise<ServiceResult<TradingAccount>> {
    const supabase = createClient();
    try {
      const slug = generateAccountSlug(payload.account_name);

      // Check existing accounts for duplicate slug
      const { data: existingAccounts } = await supabase
        .from("trading_accounts")
        .select("id, account_name, slug")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (existingAccounts && !isAccountSlugUnique(slug, existingAccounts)) {
        return {
          data: null,
          error: "An account with this name already exists.",
        };
      }

      const displayId = payload.display_id || generateDisplayAccountId();
      const isDefault = existingAccounts ? existingAccounts.length === 0 : true;

      const newAccountPayload = {
        ...payload,
        user_id: userId,
        slug,
        display_id: displayId,
        account_number: payload.account_number || displayId,
        is_default: isDefault,
        is_active: true,
      };

      const { data, error } = await supabase
        .from("trading_accounts")
        .insert(newAccountPayload)
        .select()
        .single();

      if (error) {
        console.error("[AccountService] Error creating account:", error);
        return { data: null, error: error.message };
      }

      emitAppEvent("tradefourge:account-created", { accountId: data.id });
      return { data, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      return { data: null, error: message };
    }
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
    try {
      let slug: string | undefined = undefined;

      if (updates.account_name) {
        slug = generateAccountSlug(updates.account_name);
        const { data: existingAccounts } = await supabase
          .from("trading_accounts")
          .select("id, account_name, slug")
          .eq("user_id", userId)
          .eq("is_active", true);

        if (existingAccounts && !isAccountSlugUnique(slug, existingAccounts, id)) {
          return {
            data: null,
            error: "An account with this name already exists.",
          };
        }
      }

      const payloadToUpdate = slug
        ? { ...updates, slug, updated_at: new Date().toISOString() }
        : { ...updates, updated_at: new Date().toISOString() };

      const { data, error } = await supabase
        .from("trading_accounts")
        .update(payloadToUpdate)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) return { data: null, error: error.message };

      emitAppEvent("tradefourge:account-updated", { accountId: data.id });
      return { data, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update account";
      return { data: null, error: message };
    }
  }

  /**
   * Delete (soft delete / active flag) a trading account.
   */
  static async deleteAccount(id: string, userId: string): Promise<ServiceResult<boolean>> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("trading_accounts")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) return { data: false, error: error.message };

      emitAppEvent("tradefourge:account-deleted", { accountId: id });
      return { data: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete account";
      return { data: false, error: message };
    }
  }
}
