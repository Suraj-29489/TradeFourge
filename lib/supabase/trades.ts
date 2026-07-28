// lib/supabase/trades.ts
// CRUD service for the trades table with 3-tier duplicate detection, verified delete operations, and dev logging.

import { createClient } from './client';
import { emitAppEvent } from '@/lib/events/event-bus';
import type {
  CloudTrade,
  CloudTradeWithRelations,
  NewCloudTrade,
  UpdateCloudTrade,
  CloudTradeFilters,
  PaginatedResult,
  ServiceResult,
} from '@/types/database';
import { subDays, startOfMonth, startOfYear, formatISO } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateRangeToISO(
  dateRange: CloudTradeFilters['dateRange']
): { from: string; to: string } | null {
  const now = new Date();
  switch (dateRange) {
    case '7D':
      return { from: formatISO(subDays(now, 7)), to: formatISO(now) };
    case '30D':
      return { from: formatISO(subDays(now, 30)), to: formatISO(now) };
    case '90D':
      return { from: formatISO(subDays(now, 90)), to: formatISO(now) };
    case 'THIS_MONTH':
      return { from: formatISO(startOfMonth(now)), to: formatISO(now) };
    case 'THIS_YEAR':
      return { from: formatISO(startOfYear(now)), to: formatISO(now) };
    default:
      return null;
  }
}

// ─── Fetch (Paginated + Filtered) ─────────────────────────────────────────────

export async function fetchTrades(
  userId: string,
  filters: Partial<CloudTradeFilters> = {},
  page = 1,
  pageSize = 25,
  sortBy: keyof CloudTrade = 'close_time',
  sortAsc = false
): Promise<ServiceResult<PaginatedResult<CloudTradeWithRelations>>> {
  const supabase = createClient();
  try {
    let query = supabase
      .from('trades')
      .select(
        `
        *,
        account:trading_accounts(id, account_name, broker, currency),
        tags:trade_tag_links(
          tag:trade_tags(id, name, color)
        )
        `,
        { count: 'exact' }
      )
      .eq('user_id', userId);

    if (filters.side && filters.side !== 'ALL') {
      query = query.eq('side', filters.side);
    }
    if (filters.outcome && filters.outcome !== 'ALL') {
      query = query.eq('outcome', filters.outcome);
    }
    if (filters.accountId && filters.accountId !== 'ALL') {
      query = query.eq('account_id', filters.accountId);
    }
    if (filters.source && filters.source !== 'ALL') {
      query = query.eq('source', filters.source);
    }
    if (filters.symbol && filters.symbol !== '') {
      query = query.ilike('symbol', `%${filters.symbol}%`);
    }
    if (filters.search && filters.search !== '') {
      query = query.or(
        `symbol.ilike.%${filters.search}%,ticket.ilike.%${filters.search}%,notes.ilike.%${filters.search}%,strategy.ilike.%${filters.search}%`
      );
    }

    const dateRange = dateRangeToISO(filters.dateRange ?? 'ALL');
    if (dateRange) {
      query = query
        .gte('close_time', dateRange.from)
        .lte('close_time', dateRange.to);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order(sortBy as string, { ascending: sortAsc })
      .range(from, to);

    if (error) return { data: null, error: error.message };

    const normalized = (data ?? []).map((trade: Record<string, unknown>) => ({
      ...trade,
      tags: Array.isArray(trade.tags)
        ? (trade.tags as Array<{ tag: unknown }>)
            .map((link) => link.tag)
            .filter(Boolean)
        : [],
    })) as CloudTradeWithRelations[];

    const total = count ?? 0;
    return {
      data: {
        data: normalized,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch trades';
    return { data: null, error: message };
  }
}

export async function fetchTradeById(
  id: string,
  userId: string
): Promise<ServiceResult<CloudTradeWithRelations>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trades')
      .select(
        `
        *,
        account:trading_accounts(id, account_name, broker, currency),
        tags:trade_tag_links(
          tag:trade_tags(id, name, color)
        ),
        images:trade_images(*)
        `
      )
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) return { data: null, error: error.message };

    const normalized = {
      ...data,
      tags: Array.isArray(data.tags)
        ? (data.tags as Array<{ tag: unknown }>).map((l) => l.tag).filter(Boolean)
        : [],
    } as CloudTradeWithRelations;

    return { data: normalized, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch trade';
    return { data: null, error: message };
  }
}

// ─── Aggregate Stats ──────────────────────────────────────────────────────────

export interface CloudTradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  totalNetProfit: number;
  winRate: number;
}

export async function fetchTradeStats(
  userId: string
): Promise<ServiceResult<CloudTradeStats>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('outcome, net_profit')
      .eq('user_id', userId);

    if (error) return { data: null, error: error.message };

    const trades: { outcome: string | null; net_profit: number | null }[] = data ?? [];
    const totalTrades = trades.length;
    const winningTrades = trades.filter((t) => t.outcome === 'WIN').length;
    const losingTrades = trades.filter((t) => t.outcome === 'LOSS').length;
    const breakevenTrades = trades.filter((t) => t.outcome === 'BREAKEVEN').length;
    const totalNetProfit = trades.reduce((sum, t) => sum + (t.net_profit ?? 0), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return {
      data: { totalTrades, winningTrades, losingTrades, breakevenTrades, totalNetProfit, winRate },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch trade stats';
    return { data: null, error: message };
  }
}

// ─── Deduplication Engine ──────────────────────────────────────────────────────

export async function deduplicateTrades(
  userId: string,
  candidates: NewCloudTrade[]
): Promise<{ uniqueTrades: NewCloudTrade[]; skippedDuplicates: number }> {
  if (!candidates || candidates.length === 0) {
    return { uniqueTrades: [], skippedDuplicates: 0 };
  }

  const supabase = createClient();

  const { data: dbTrades } = await supabase
    .from('trades')
    .select('ticket, external_trade_id, open_time, close_time, symbol, side, volume, account_id')
    .eq('user_id', userId);

  const existing = dbTrades || [];

  const isDuplicate = (cand: Record<string, any>, matchTarget: Record<string, any>) => {
    // Priority 1: external_trade_id
    if (cand.external_trade_id && matchTarget.external_trade_id) {
      if (cand.external_trade_id === matchTarget.external_trade_id) return true;
    }

    // Priority 2: ticket + account_id
    if (cand.ticket && matchTarget.ticket) {
      const sameTicket = String(cand.ticket).trim() === String(matchTarget.ticket).trim();
      const sameAcc = (cand.account_id || null) === (matchTarget.account_id || null);
      if (sameTicket && sameAcc) return true;
    }

    // Priority 3: symbol + open_time + close_time + side + volume
    const sameSymbol = String(cand.symbol || '').toUpperCase() === String(matchTarget.symbol || '').toUpperCase();
    const sameSide = String(cand.side || '').toUpperCase() === String(matchTarget.side || '').toUpperCase();
    const sameVol = Math.abs(Number(cand.volume || 0) - Number(matchTarget.volume || 0)) < 0.0001;

    const candOpen = cand.open_time ? new Date(cand.open_time).getTime() : null;
    const targetOpen = matchTarget.open_time ? new Date(matchTarget.open_time).getTime() : null;
    const sameOpen = candOpen !== null && targetOpen !== null && Math.abs(candOpen - targetOpen) < 2000;

    const candClose = cand.close_time ? new Date(cand.close_time).getTime() : null;
    const targetClose = matchTarget.close_time ? new Date(matchTarget.close_time).getTime() : null;
    const sameClose = candClose !== null && targetClose !== null && Math.abs(candClose - targetClose) < 2000;

    return sameSymbol && sameSide && sameVol && sameOpen && sameClose;
  };

  const uniqueTrades: NewCloudTrade[] = [];
  let skippedDuplicates = 0;

  for (const cand of candidates) {
    const existsInDb = existing.some((t: Record<string, any>) => isDuplicate(cand, t));
    if (existsInDb) {
      skippedDuplicates++;
      continue;
    }

    const existsInBatch = uniqueTrades.some((accepted: Record<string, any>) => isDuplicate(cand, accepted));
    if (existsInBatch) {
      skippedDuplicates++;
      continue;
    }

    uniqueTrades.push(cand);
  }

  return { uniqueTrades, skippedDuplicates };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createTrade(
  userId: string,
  payload: NewCloudTrade
): Promise<ServiceResult<CloudTrade>> {
  const supabase = createClient();
  try {
    const { uniqueTrades } = await deduplicateTrades(userId, [payload]);
    if (uniqueTrades.length === 0) {
      return { data: null, error: "Duplicate trade detected. Skip creation." };
    }

    const { net_profit, ...cleanPayload } = uniqueTrades[0] as Record<string, any>;
    const { data, error } = await supabase
      .from('trades')
      .insert({ ...cleanPayload, user_id: userId })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    emitAppEvent("tradefourge:trade-created", { tradeId: data.id });
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create trade';
    return { data: null, error: message };
  }
}

export async function bulkInsertTrades(
  userId: string,
  trades: NewCloudTrade[]
): Promise<{ inserted: number; skippedDuplicates: number; errors: string[] }> {
  const { uniqueTrades, skippedDuplicates } = await deduplicateTrades(userId, trades);

  if (uniqueTrades.length === 0) {
    return { inserted: 0, skippedDuplicates, errors: [] };
  }

  const supabase = createClient();
  const BATCH_SIZE = 100;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < uniqueTrades.length; i += BATCH_SIZE) {
    const batch = uniqueTrades.slice(i, i + BATCH_SIZE).map((t) => {
      const { net_profit, ...cleanT } = t as Record<string, any>;
      return {
        ...cleanT,
        user_id: userId,
      };
    });

    const { data, error } = await supabase
      .from('trades')
      .insert(batch)
      .select('id');

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
    } else {
      inserted += data?.length ?? 0;
    }
  }

  if (inserted > 0) {
    emitAppEvent("tradefourge:trade-created", { count: inserted });
  }

  return { inserted, skippedDuplicates, errors };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateTrade(
  id: string,
  userId: string,
  updates: UpdateCloudTrade
): Promise<ServiceResult<CloudTrade>> {
  const supabase = createClient();
  try {
    const { net_profit, ...cleanUpdates } = updates as Record<string, any>;
    const { data, error } = await supabase
      .from('trades')
      .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    emitAppEvent("tradefourge:trade-updated", { tradeId: id });
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update trade';
    return { data: null, error: message };
  }
}

// ─── Verified Delete Operations ───────────────────────────────────────────────

export async function deleteTrade(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createClient();
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[TradeFourge Dev Log] Delete Request — Target Trade ID: ${id}, User ID: ${userId}`);
    }

    // 1. DELETE with .select('id') to get affected rows count
    const { data: deletedRows, error: deleteErr } = await supabase
      .from('trades')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id');

    if (deleteErr) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[TradeFourge Dev Log] Delete Failed — Error: ${deleteErr.message}`);
      }
      return { data: false, error: deleteErr.message };
    }

    const rowsAffected = deletedRows?.length ?? 0;

    if (rowsAffected === 0) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[TradeFourge Dev Log] Delete Warning — 0 rows affected. Nothing was deleted from DB.`);
      }
      return { data: false, error: "Nothing was deleted." };
    }

    // 2. Perform fresh verification query to confirm record is gone from PostgreSQL
    const { data: checkRow } = await supabase
      .from('trades')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (checkRow) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[TradeFourge Dev Log] Delete Verification Failed — Record ${id} still exists in DB after DELETE!`);
      }
      return { data: false, error: "Delete failed. Record still exists in database." };
    }

    // 3. Query remaining user trades count for dev log
    const { count: remainingCount } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[TradeFourge Dev Log] Delete Success — Deleted ID: ${id}, Rows Affected: ${rowsAffected}, Remaining User Trades: ${remainingCount ?? 0}`);
    }

    emitAppEvent("tradefourge:trade-deleted", { tradeId: id });
    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete trade';
    return { data: false, error: message };
  }
}

export async function deleteAllTrades(userId: string): Promise<ServiceResult<number>> {
  const supabase = createClient();
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[TradeFourge Dev Log] Delete All Trades Request — User ID: ${userId}`);
    }

    const { data: deletedRows, error: deleteErr } = await supabase
      .from('trades')
      .delete()
      .eq('user_id', userId)
      .select('id');

    if (deleteErr) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[TradeFourge Dev Log] Delete All Trades Failed — Error: ${deleteErr.message}`);
      }
      return { data: 0, error: deleteErr.message };
    }

    const count = deletedRows?.length ?? 0;

    if (count === 0) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[TradeFourge Dev Log] Delete All Trades — 0 trades found to delete.`);
      }
      return { data: 0, error: null };
    }

    // Verification check
    const { count: remainingCount } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (remainingCount && remainingCount > 0) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[TradeFourge Dev Log] Delete All Trades Verification Failed — ${remainingCount} trades remain!`);
      }
      return { data: 0, error: "Delete failed. Trades still exist in database." };
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[TradeFourge Dev Log] Delete All Trades Success — Deleted Rows: ${count}, Remaining Rows: 0`);
    }

    emitAppEvent("tradefourge:trade-deleted", { count, all: true });
    return { data: count, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete trades';
    return { data: 0, error: message };
  }
}

export async function deleteTradesByImportId(
  importId: string,
  userId: string
): Promise<ServiceResult<number>> {
  const supabase = createClient();
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[TradeFourge Dev Log] Delete Trades by Import ID Request — Import ID: ${importId}`);
    }

    const { data: deletedRows, error: deleteErr } = await supabase
      .from('trades')
      .delete()
      .eq('import_id', importId)
      .eq('user_id', userId)
      .select('id');

    if (deleteErr) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[TradeFourge Dev Log] Delete Trades by Import ID Failed — Error: ${deleteErr.message}`);
      }
      return { data: 0, error: deleteErr.message };
    }

    const count = deletedRows?.length ?? 0;

    const { count: remainingCount } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('import_id', importId)
      .eq('user_id', userId);

    if (remainingCount && remainingCount > 0) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[TradeFourge Dev Log] Delete Trades by Import ID Verification Failed — ${remainingCount} trades remain for import ${importId}`);
      }
      return { data: 0, error: "Delete failed. Import trades still exist in database." };
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[TradeFourge Dev Log] Delete Trades by Import ID Success — Import ID: ${importId}, Deleted Trades: ${count}, Remaining Trades for Import: 0`);
    }

    emitAppEvent("tradefourge:trade-deleted", { count, importId });
    return { data: count, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete import trades';
    return { data: 0, error: message };
  }
}
