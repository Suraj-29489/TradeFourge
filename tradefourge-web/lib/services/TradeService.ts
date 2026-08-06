// lib/services/TradeService.ts
// Dedicated Data Layer Service for Trades.

import { createClient } from "@/lib/supabase/client";
import { emitAppEvent } from "@/lib/events/event-bus";
import type {
  CloudTrade,
  CloudTradeWithRelations,
  NewCloudTrade,
  UpdateCloudTrade,
  CloudTradeFilters,
  PaginatedResult,
  ServiceResult,
} from "@/types/database";

export class TradeService {
  /**
   * Fetch paginated and filtered trades from Supabase.
   */
  static async getTrades(
    userId: string,
    filters: Partial<CloudTradeFilters> = {},
    page = 1,
    pageSize = 25,
    sortBy: keyof CloudTrade = "close_time",
    sortAsc = false
  ): Promise<ServiceResult<PaginatedResult<CloudTradeWithRelations>>> {
    const supabase = createClient();
    try {
      let query = supabase
        .from("trades")
        .select(
          `
          *,
          account:trading_accounts(id, account_name, slug, broker, currency),
          tags:trade_tag_links(
            tag:trade_tags(id, name, color)
          )
          `,
          { count: "exact" }
        )
        .eq("user_id", userId);

      if (filters.side && filters.side !== "ALL") {
        query = query.eq("side", filters.side);
      }
      if (filters.outcome && filters.outcome !== "ALL") {
        query = query.eq("outcome", filters.outcome);
      }
      if (filters.accountId && filters.accountId !== "ALL") {
        query = query.eq("account_id", filters.accountId);
      }
      if (filters.source && filters.source !== "ALL") {
        query = query.eq("source", filters.source);
      }
      if (filters.symbol && filters.symbol !== "") {
        query = query.ilike("symbol", `%${filters.symbol}%`);
      }
      if (filters.search && filters.search !== "") {
        query = query.or(
          `symbol.ilike.%${filters.search}%,ticket.ilike.%${filters.search}%,notes.ilike.%${filters.search}%,strategy.ilike.%${filters.search}%`
        );
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order(sortBy, { ascending: sortAsc })
        .range(from, to);

      if (error) return { data: null, error: error.message };

      const total = count ?? 0;
      const totalPages = Math.ceil(total / pageSize);

      return {
        data: {
          data: (data as CloudTradeWithRelations[]) ?? [],
          total,
          page,
          pageSize,
          totalPages,
        },
        error: null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch trades";
      return { data: null, error: message };
    }
  }

  /**
   * Insert a single trade.
   */
  static async createTrade(
    userId: string,
    payload: NewCloudTrade
  ): Promise<ServiceResult<CloudTrade>> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("trades")
        .insert({ ...payload, user_id: userId })
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      emitAppEvent("tradefourge:trade-created", { tradeId: data.id });
      return { data, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create trade";
      return { data: null, error: message };
    }
  }

  /**
   * Bulk insert trades into Supabase in batches.
   */
  static async bulkInsertTrades(
    userId: string,
    trades: NewCloudTrade[]
  ): Promise<{ inserted: number; skippedDuplicates: number; errors: string[] }> {
    const supabase = createClient();
    const BATCH_SIZE = 100;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < trades.length; i += BATCH_SIZE) {
      const batch = trades.slice(i, i + BATCH_SIZE).map((t) => {
        const { net_profit, ...cleanT } = t as Record<string, any>;
        return {
          ...cleanT,
          user_id: userId,
        };
      });

      const { data, error } = await supabase
        .from("trades")
        .insert(batch)
        .select("id");

      if (error) {
        errors.push(error.message);
      } else {
        inserted += data ? data.length : 0;
      }
    }

    emitAppEvent("tradefourge:data-changed", { action: "bulkInsertTrades", inserted });
    return { inserted, skippedDuplicates: 0, errors };
  }

  /**
   * Delete a trade from Supabase.
   */
  static async deleteTrade(id: string, userId: string): Promise<ServiceResult<boolean>> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("trades")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) return { data: false, error: error.message };

      emitAppEvent("tradefourge:trade-deleted", { tradeId: id });
      return { data: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete trade";
      return { data: false, error: message };
    }
  }
}
