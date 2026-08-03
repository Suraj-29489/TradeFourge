// lib/live-sync/trade-merger.ts
// TradeFourge v4.0 Incremental Trade Merger
// Converts LiveTradePayload to CloudTrade entity format and handles incremental persistence.

import type { CloudTrade, NewCloudTrade, TradeOutcome } from "@/types/database";
import type { LiveTradePayload } from "./broker-types";

export function deriveOutcome(profit: number, closeTime?: string | null): TradeOutcome {
  if (!closeTime) return "OPEN";
  if (profit > 0.001) return "WIN";
  if (profit < -0.001) return "LOSS";
  return "BREAKEVEN";
}

export function mapLivePayloadToNewTrade(
  userId: string,
  accountId: string,
  payload: LiveTradePayload
): NewCloudTrade {
  const netProfit = payload.profit + payload.commission + payload.swap;
  const outcome = payload.outcome || deriveOutcome(payload.profit, payload.closeTime);

  return {
    account_id: accountId,
    ticket: payload.ticket,
    symbol: payload.symbol.toUpperCase(),
    side: payload.side,
    volume: payload.volume,
    open_price: payload.openPrice,
    close_price: payload.closePrice ?? null,
    stop_loss: payload.stopLoss ?? null,
    take_profit: payload.takeProfit ?? null,
    open_time: payload.openTime,
    close_time: payload.closeTime ?? null,
    duration_seconds: payload.openTime && payload.closeTime
      ? Math.floor((new Date(payload.closeTime).getTime() - new Date(payload.openTime).getTime()) / 1000)
      : null,
    profit: payload.profit,
    commission: payload.commission,
    swap: payload.swap,
    rr_ratio: null,
    risk_amount: null,
    outcome: outcome,
    source: "api",
    session: null,
    strategy: "Live Sync",
    notes: payload.notes || "Synchronized via Live Broker Connector",
    emotions: null,
    lessons: null,
    mistakes: null,
    magic_number: payload.magicNumber ?? null,
  };
}
