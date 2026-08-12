// app/api/mt5/heartbeat/route.ts
// POST /api/mt5/heartbeat — Liveness signal from local MT5 Connector.

import { NextRequest } from "next/server";
import { mt5Success, mt5Error } from "@/lib/api/mt5-response";
import { validateConnectorAuth } from "@/lib/api/mt5-auth";
import { checkRateLimit } from "@/lib/api/mt5-rate-limiter";
import { MT5ConnectorService } from "@/lib/services/MT5ConnectorService";
import type { MT5HeartbeatRequest, MT5HeartbeatResponse } from "@/types/mt5-api";

export async function POST(request: NextRequest) {
  try {
    // 1. Validate API Key Authorization
    const { connector, error: authError, status: authStatus } = await validateConnectorAuth(request);
    if (!connector || authError) {
      return mt5Error("UNAUTHORIZED", authError || "Authentication failed.", authStatus);
    }

    // 2. Rate Limiting (60 requests per minute per connector)
    const limit = checkRateLimit(`heartbeat_${connector.connectorId}`, { maxRequests: 60, windowMs: 60000 });
    if (!limit.allowed) {
      return mt5Error("RATE_LIMITED", "Heartbeat rate limit exceeded.", 429);
    }

    // 3. Parse Request Payload
    const body: MT5HeartbeatRequest = await request.json().catch(() => ({}) as any);
    const clientIp = request.headers.get("x-forwarded-for") || "direct_ip";

    // 4. Update Connector Heartbeat Record
    const { success, error: hbError } = await MT5ConnectorService.processHeartbeat(
      connector.connectorId,
      body.version,
      clientIp
    );

    if (!success) {
      return mt5Error("HEARTBEAT_FAILED", hbError || "Failed to record heartbeat.", 500);
    }

    const responsePayload: MT5HeartbeatResponse = {
      status: "ok",
      server_time: new Date().toISOString(),
      next_heartbeat_seconds: 60,
      active_accounts_count: body.connected_accounts ? body.connected_accounts.length : 0,
    };

    return mt5Success(responsePayload, 200);
  } catch (err: any) {
    return mt5Error("INTERNAL_ERROR", err?.message || "An error occurred during heartbeat processing.", 500);
  }
}
