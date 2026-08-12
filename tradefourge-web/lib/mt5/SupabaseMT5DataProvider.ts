import {
  MT5DataProvider,
  MT5Account,
  MT5Trade,
  MT5TradeFilter,
  MT5Timeframe,
  MT5EquityPoint,
} from "@/types/mt5";
import { createClient } from "@/lib/supabase/client";
import type { TradingAccount, CloudTrade } from "@/types/database";

export class SupabaseMT5DataProvider implements MT5DataProvider {
  private get supabase() {
    return createClient();
  }

  private mapDbAccountToMT5Account(acc: TradingAccount): MT5Account {
    const isConnected = acc.is_connected ?? acc.is_active ?? false;
    let status: MT5Account["connectionStatus"] = isConnected ? "Connected" : "Disconnected";
    if (acc.live_status === "Syncing") status = "Syncing";

    return {
      id: acc.id,
      accountNumber: acc.account_number || acc.mt5_login_number || acc.display_id || acc.id,
      server: acc.mt5_server || acc.broker || "MetaTrader 5",
      accountType: (acc.account_type as any) || "Standard",
      currency: (acc.currency as any) || "USD",
      leverage: acc.leverage || "1:100",
      balance: Number(acc.current_balance ?? acc.starting_balance ?? 0),
      equity: Number(acc.equity ?? acc.current_balance ?? acc.starting_balance ?? 0),
      freeMargin: Number(acc.free_margin ?? acc.equity ?? acc.current_balance ?? 0),
      margin: Number(acc.margin ?? 0),
      marginLevel: acc.margin_level ? Number(acc.margin_level) : null,
      floatingPnl: Number((acc.equity ?? 0) - (acc.current_balance ?? 0)),
      profitToday: 0, // Calculated dynamically when trades are loaded
      connectionStatus: status,
      lastUpdated: acc.last_synced_at || acc.updated_at || new Date().toISOString(),
      connectorId: acc.connector_id || undefined,
      isPaired: acc.is_mt5_paired ?? Boolean(acc.connector_id),
    };
  }

  private mapDbTradeToMT5Trade(tr: CloudTrade, accountNumber: string): MT5Trade {
    const openPrice = Number(tr.open_price ?? 0);
    const closePrice = tr.close_price !== null ? Number(tr.close_price) : null;
    const profit = Number(tr.net_profit ?? tr.profit ?? 0);
    const side = (tr.side === "BUY" || tr.side === "LONG" ? "BUY" : "SELL") as "BUY" | "SELL";
    const status = tr.outcome === "OPEN" || tr.close_time === null ? "OPEN" : "CLOSED";

    return {
      ticket: tr.mt5_deal_id || tr.ticket || tr.id,
      orderId: tr.mt5_order_id || tr.ticket || tr.id,
      accountNumber,
      symbol: tr.symbol,
      side,
      volume: Number(tr.volume),
      openTime: tr.open_time || tr.created_at,
      closeTime: tr.close_time,
      openPrice,
      closePrice,
      stopLoss: tr.stop_loss !== null ? Number(tr.stop_loss) : null,
      takeProfit: tr.take_profit !== null ? Number(tr.take_profit) : null,
      commission: Number(tr.commission ?? 0),
      swap: Number(tr.swap ?? 0),
      profit,
      status,
      dealId: tr.mt5_deal_id || undefined,
      positionId: tr.mt5_position_id || undefined,
    };
  }

  async getAccounts(): Promise<MT5Account[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await this.supabase
      .from("trading_accounts")
      .select("*")
      .eq("user_id", user.id)
      .or("platform.eq.MetaTrader 5,is_mt5_paired.eq.true,connector_id.not.is.null")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Notice: Error fetching MT5 accounts from Supabase", error);
      return [];
    }

    return ((data || []) as TradingAccount[]).map((acc: TradingAccount) => this.mapDbAccountToMT5Account(acc));
  }

  async getAccount(accountId: string): Promise<MT5Account | null> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await this.supabase
      .from("trading_accounts")
      .select("*")
      .eq("user_id", user.id)
      .or(`id.eq.${accountId},account_number.eq.${accountId},mt5_login_number.eq.${accountId}`)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapDbAccountToMT5Account(data);
  }

  async addAccount(accountData: Omit<MT5Account, "id" | "balance" | "equity" | "freeMargin" | "floatingPnl" | "profitToday" | "connectionStatus" | "lastUpdated"> & { password?: string }): Promise<MT5Account> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const payload = {
      user_id: user.id,
      account_name: `${accountData.server} #${accountData.accountNumber}`,
      broker: accountData.server,
      platform: "MetaTrader 5",
      account_number: accountData.accountNumber,
      mt5_login_number: accountData.accountNumber,
      account_type: accountData.accountType || "Live",
      currency: accountData.currency || "USD",
      leverage: accountData.leverage || "1:100",
      starting_balance: 0,
      current_balance: 0,
      equity: 0,
      is_mt5_paired: true,
      is_connected: true,
      is_active: true,
      is_default: false,
    };

    const { data, error } = await this.supabase
      .from("trading_accounts")
      .insert([payload])
      .select()
      .single();

    if (error) throw new Error(`Failed to add account: ${error.message}`);
    return this.mapDbAccountToMT5Account(data);
  }

  async refreshAccount(accountId: string): Promise<MT5Account> {
    const acc = await this.getAccount(accountId);
    if (!acc) throw new Error("Account not found");
    return acc;
  }

  async disconnectAccount(accountId: string): Promise<boolean> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return false;

    const { error } = await this.supabase
      .from("trading_accounts")
      .update({
        is_connected: false,
        is_mt5_paired: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .or(`id.eq.${accountId},account_number.eq.${accountId}`);

    return !error;
  }

  async getTrades(accountId: string, filter?: MT5TradeFilter): Promise<MT5Trade[]> {
    if (!accountId || !accountId.trim()) return [];

    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return [];

    const targetAcc = await this.getAccount(accountId);
    if (!targetAcc) return [];

    let query = this.supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .eq("account_id", targetAcc.id)
      .or("source.eq.mt5,source.eq.MT5,mt5_deal_id.not.is.null")
      .order("close_time", { ascending: false, nullsFirst: false });

    if (filter) {
      if (filter.startDate) {
        query = query.gte("open_time", filter.startDate);
      }
      if (filter.endDate) {
        query = query.lte("open_time", filter.endDate);
      }
      if (filter.symbol && filter.symbol !== "ALL") {
        query = query.ilike("symbol", filter.symbol);
      }
      if (filter.side && filter.side !== "ALL") {
        query = query.eq("side", filter.side);
      }
      if (filter.status && filter.status !== "ALL") {
        if (filter.status === "OPEN") {
          query = query.is("close_time", null);
        } else if (filter.status === "CLOSED") {
          query = query.not("close_time", "is", null);
        }
      }
    }

    const { data, error } = await query;
    if (error) {
      console.warn("Notice: Error fetching trades from Supabase", error);
      return [];
    }

    const accNum = targetAcc.accountNumber || accountId || "N/A";
    let result = ((data || []) as CloudTrade[]).map((tr: CloudTrade) => this.mapDbTradeToMT5Trade(tr, accNum));

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.ticket.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.orderId.toLowerCase().includes(q)
      );
    }

    return result;
  }

  async fetchHistoricalTrades(accountId: string, fromDate: string, toDate: string): Promise<{ addedCount: number }> {
    if (!accountId || !accountId.trim()) return { addedCount: 0 };
    const trades = await this.getTrades(accountId, { startDate: fromDate, endDate: toDate });
    return { addedCount: trades.length };
  }

  async getEquityHistory(accountId: string, timeframe: MT5Timeframe): Promise<{
    points: MT5EquityPoint[];
    startingBalance: number;
    currentEquity: number;
    high: number;
    low: number;
  }> {
    if (!accountId || !accountId.trim()) {
      return {
        points: [],
        startingBalance: 0,
        currentEquity: 0,
        high: 0,
        low: 0,
      };
    }

    const acc = await this.getAccount(accountId);
    if (!acc) {
      return {
        points: [],
        startingBalance: 0,
        currentEquity: 0,
        high: 0,
        low: 0,
      };
    }

    const startingBalance = acc.balance;
    const currentEquity = acc.equity || startingBalance;

    const trades = await this.getTrades(accountId);
    const closedTrades = trades
      .filter((t) => t.status === "CLOSED" && t.closeTime)
      .sort((a, b) => new Date(a.closeTime!).getTime() - new Date(b.closeTime!).getTime());

    if (closedTrades.length === 0) {
      const nowISO = new Date().toISOString();
      return {
        points: [
          { timestamp: nowISO, equity: currentEquity, balance: startingBalance },
        ],
        startingBalance,
        currentEquity,
        high: currentEquity,
        low: currentEquity,
      };
    }

    let runningEquity = startingBalance;
    let high = runningEquity;
    let low = runningEquity;
    const points: MT5EquityPoint[] = [];

    for (const tr of closedTrades) {
      runningEquity += tr.profit;
      if (runningEquity > high) high = runningEquity;
      if (runningEquity < low) low = runningEquity;

      points.push({
        timestamp: tr.closeTime || tr.openTime,
        equity: Number(runningEquity.toFixed(2)),
        balance: Number(runningEquity.toFixed(2)),
      });
    }

    return {
      points,
      startingBalance,
      currentEquity: Number(runningEquity.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
    };
  }
}

export const defaultMT5DataProvider = new SupabaseMT5DataProvider();
