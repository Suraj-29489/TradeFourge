// app/api/mt5/accounts/sync/route.ts
// POST /api/mt5/accounts/sync — Synchronize MT5 account metadata from local connector.

import { NextRequest } from "next/server";
import { mt5Success, mt5Error } from "@/lib/api/mt5-response";
import { validateConnectorAuth } from "@/lib/api/mt5-auth";
import { checkRateLimit } from "@/lib/api/mt5-rate-limiter";
import { MT5SyncService } from "@/lib/services/MT5SyncService";
import type { MT5AccountSyncRequest } from "@/types/mt5-api";

export async function POST(request: NextRequest) {
  try {
    // 1. Validate API Key Authorization
    const { connector, error: authError, status: authStatus } = await validateConnectorAuth(request);
    if (!connector || authError) {
      return mt5Error("UNAUTHORIZED", authError || "Authentication failed.", authStatus);
    }

    // 2. Rate Limiting (10 requests per minute per connector)
    const limit = checkRateLimit(`acc_sync_${connector.connectorId}`, { maxRequests: 10, windowMs: 60000 });
    if (!limit.allowed) {
      return mt5Error("RATE_LIMITED", "Account sync rate limit exceeded.", 429);
    }

    // 3. Parse Payload
    const body: MT5AccountSyncRequest = await request.json().catch(() => ({}) as any);
    if (!body.accounts || !Array.isArray(body.accounts) || body.accounts.length === 0) {
      return mt5Error("VALIDATION_ERROR", "Field 'accounts' must be a non-empty array.", 400);
    }

    // 4. Process Account Sync
    const syncResult = await MT5SyncService.syncAccounts(
      connector.userId,
      connector.connectorId,
      body.accounts
    );

    return mt5Success(syncResult, 200);
  } catch (err: any) {
    return mt5Error("INTERNAL_ERROR", err?.message || "Account sync failed.", 500);
  }
}
