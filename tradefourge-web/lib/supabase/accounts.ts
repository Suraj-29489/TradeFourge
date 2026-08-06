// lib/supabase/accounts.ts
// Re-export / Delegate service for trading_accounts table.
// Delegates to AccountService in lib/services/AccountService.ts.

import { AccountService } from '@/lib/services/AccountService';
import type {
  TradingAccount,
  NewTradingAccount,
  UpdateTradingAccount,
  ServiceResult,
} from '@/types/database';

export async function fetchTradingAccounts(
  userId: string
): Promise<ServiceResult<TradingAccount[]>> {
  return AccountService.getAccounts(userId);
}

export async function fetchTradingAccountById(
  id: string,
  userId: string
): Promise<ServiceResult<TradingAccount>> {
  return AccountService.getAccountById(id, userId);
}

export async function createTradingAccount(
  userId: string,
  payload: NewTradingAccount
): Promise<ServiceResult<TradingAccount>> {
  return AccountService.createAccount(userId, payload);
}

export async function updateTradingAccount(
  id: string,
  userId: string,
  updates: UpdateTradingAccount
): Promise<ServiceResult<TradingAccount>> {
  return AccountService.updateAccount(id, userId, updates);
}

export async function deleteTradingAccount(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  return AccountService.deleteAccount(id, userId);
}
