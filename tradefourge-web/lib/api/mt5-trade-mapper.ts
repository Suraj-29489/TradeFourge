// lib/api/mt5-trade-mapper.ts
// Field Mapping & Validation Utility for converting raw MT5 deal payloads into CloudTrade models.

import type { NewCloudTrade, TradeOutcome, TradeSide } from "@/types/database";
import type { MT5TradeBatchPayload } from "@/types/mt5-api";

export interface TradeMapResult {
  validTrade: NewCloudTrade | null;
  errorReason: string | null;
}

/**
 * Maps a single MT5 deal payload to a valid CloudTrade insertion object.
 */
export function mapMT5DealToCloudTrade(
  deal: MT5TradeBatchPayload,
  userId: string,
  accountId: string,
  connectorId: string,
  batchId: string
): TradeMapResult {
  if (!deal.deal_id || String(deal.deal_id).trim() === "") {
    return { validTrade: null, errorReason: "Missing required deal_id (MT5 ticket)" };
  }

  if (!deal.symbol || String(deal.symbol).trim() === "") {
    return { validTrade: null, errorReason: `Deal #${deal.deal_id}: Missing symbol` };
  }

  const rawSide = String(deal.side || "").toUpperCase();
  let side: TradeSide = "BUY";
  if (rawSide === "SELL" || rawSide === "SHORT") {
    side = "SELL";
  } else if (rawSide === "BUY" || rawSide === "LONG") {
    side = "BUY";
  } else {
    return { validTrade: null, errorReason: `Deal #${deal.deal_id}: Invalid side "${deal.side}"` };
  }

  const volume = Number(deal.volume) || 0;
  if (volume <= 0) {
    return { validTrade: null, errorReason: `Deal #${deal.deal_id}: Volume must be greater than 0` };
  }

  const openPrice = Number(deal.open_price) || 0;
  const closePrice = Number(deal.close_price) || openPrice;
  const profit = Number(deal.profit) || 0;
  const commission = Number(deal.commission) || 0;
  const swap = Number(deal.swap) || 0;
  const netProfit = profit + commission + swap;

  // Calculate open / close timestamps and duration
  const openTimeISO = deal.open_time ? new Date(deal.open_time).toISOString() : new Date().toISOString();
  const closeTimeISO = deal.close_time ? new Date(deal.close_time).toISOString() : openTimeISO;
  
  const openMs = new Date(openTimeISO).getTime();
  const closeMs = new Date(closeTimeISO).getTime();
  const durationSeconds = Math.max(0, Math.floor((closeMs - openMs) / 1000));

  // Outcome classification
  let outcome: TradeOutcome = "BREAKEVEN";
  if (netProfit > 0.009) {
    outcome = "WIN";
  } else if (netProfit < -0.009) {
    outcome = "LOSS";
  } else {
    outcome = "BREAKEVEN";
  }

  const cloudTrade = {
    account_id: accountId,
    ticket: String(deal.deal_id),
    symbol: deal.symbol.toUpperCase().trim(),
    side,
    volume,
    open_price: openPrice,
    close_price: closePrice,
    stop_loss: deal.stop_loss != null ? Number(deal.stop_loss) : null,
    take_profit: deal.take_profit != null ? Number(deal.take_profit) : null,
    open_time: openTimeISO,
    close_time: closeTimeISO,
    duration_seconds: durationSeconds,
    profit,
    commission,
    swap,
    risk_amount: null,
    reward_amount: null,
    risk_percent: null,
    rr_ratio: null,
    outcome,
    source: "api" as const,
    magic_number: deal.magic_number != null ? Number(deal.magic_number) : null,
    strategy: deal.comment ? `MT5 (${deal.comment})` : "MT5 Direct Sync",
    notes: deal.comment ? `MT5 Deal #${deal.deal_id} — Comment: ${deal.comment}` : `Synced via MT5 Companion (Deal #${deal.deal_id})`,
    session: null,
    emotions: null,
    lessons: null,
    mistakes: null,
    connector_id: connectorId,
    mt5_deal_id: String(deal.deal_id),
    mt5_order_id: deal.order_id ? String(deal.order_id) : null,
    mt5_position_id: deal.position_id ? String(deal.position_id) : null,
    sync_batch_id: batchId,
  };

  return { validTrade: cloudTrade, errorReason: null };
}
