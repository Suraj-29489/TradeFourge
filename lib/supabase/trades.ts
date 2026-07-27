// lib/supabase/trades.ts
// CRUD service for the trades table.
// Supports server-side pagination, filtering, and full text search.

import { createClient } from './client';
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

/**
 * Fetch trades with server-side filtering and pagination.
 * Returns data + total count for pagination.
 */
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

    // Apply filters
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
      // Text search across symbol, ticket, notes, strategy
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

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order(sortBy as string, { ascending: sortAsc })
      .range(from, to);

    if (error) return { data: null, error: error.message };

    // Flatten the nested tag structure from Supabase join
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

/**
 * Fetch a single trade with all relations.
 */
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

/**
 * Fast aggregate stats for a user (used in dashboard widgets).
 */
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

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createTrade(
  userId: string,
  payload: NewCloudTrade
): Promise<ServiceResult<CloudTrade>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trades')
      .insert({ ...payload, user_id: userId })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create trade';
    return { data: null, error: message };
  }
}

/**
 * Bulk insert trades (used by CSV import).
 * Returns { inserted, errors }.
 */
export async function bulkInsertTrades(
  userId: string,
  trades: NewCloudTrade[]
): Promise<{ inserted: number; errors: string[] }> {
  const supabase = createClient();
  const BATCH_SIZE = 100;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < trades.length; i += BATCH_SIZE) {
    const batch = trades.slice(i, i + BATCH_SIZE).map((t) => ({
      ...t,
      user_id: userId,
    }));

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

  return { inserted, errors };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateTrade(
  id: string,
  userId: string,
  updates: UpdateCloudTrade
): Promise<ServiceResult<CloudTrade>> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('trades')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update trade';
    return { data: null, error: message };
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteTrade(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete trade';
    return { data: null, error: message };
  }
}
