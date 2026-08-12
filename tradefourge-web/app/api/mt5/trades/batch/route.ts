// app/api/mt5/trades/batch/route.ts
// POST /api/mt5/trades/batch — Idempotent batch trade ingestion from MetaTrader 5.

import { NextRequest } from "next/server";
import { mt5Success, mt5Error } from "@/lib/api/mt5-response";
import { validateConnectorAuth } from "@/lib/api/mt5-auth";
import { checkRateLimit } from "@/lib/api/mt5-rate-limiter";
import { MT5SyncService } from "@/lib/services/MT5SyncService";
import type { MT5TradeBatchRequest } from "@/types/mt5-api";

export async function POST(request: NextRequest) {
  try {
    // 1. Validate API Key Authorization
    const { connector, error: authError, status: authStatus } = await validateConnectorAuth(request);
    if (!connector || authError) {
      return mt5Error("UNAUTHORIZED", authError || "Authentication failed.", authStatus);
    }

    // 2. Rate Limiting (20 requests per minute per connector)
    const limit = checkRateLimit(`batch_${connector.connectorId}`, { maxRequests: 20, windowMs: 60000 });
    if (!limit.allowed) {
      return mt5Error("RATE_LIMITED", "Trade batch ingestion rate limit exceeded.", 429);
    }

    // 3. Parse & Validate Payload
    const body: MT5TradeBatchRequest = await request.json().catch(() => ({}) as any);
    const { account_number, trades, batch_type, is_reconciliation } = body;

    if (!account_number || typeof account_number !== "string" || account_number.trim() === "") {
      return mt5Error("VALIDATION_ERROR", "Field 'account_number' is required.", 400);
    }

    if (!trades || !Array.isArray(trades)) {
      return mt5Error("VALIDATION_ERROR", "Field 'trades' must be an array of deal objects.", 400);
    }

    if (trades.length > 500) {
      return mt5Error("BATCH_TOO_LARGE", "Maximum 500 trades allowed per batch request.", 400);
    }

    // 4. Ingest Trade Batch Idempotently
    const batchResult = await MT5SyncService.ingestTradeBatch(
      connector.userId,
      connector.connectorId,
      account_number,
      trades,
      batch_type || "closed_trades",
      Boolean(is_reconciliation)
    );

    return mt5Success(batchResult, 200);
  } catch (err: any) {
    return mt5Error("INTERNAL_ERROR", err?.message || "Trade batch ingestion failed.", 500);
  }
}
