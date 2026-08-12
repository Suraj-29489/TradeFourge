// app/api/mt5/pair/route.ts
// POST /api/mt5/pair — Register and pair a new MT5 Connector instance.

import { NextRequest } from "next/server";
import { mt5Success, mt5Error } from "@/lib/api/mt5-response";
import { checkRateLimit } from "@/lib/api/mt5-rate-limiter";
import { createAdminClient } from "@/lib/supabase/server";
import { MT5ConnectorService } from "@/lib/services/MT5ConnectorService";
import type { MT5PairingRequest, MT5PairingResponse } from "@/types/mt5-api";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting (5 requests per 10 minutes per IP)
    const clientIp = request.headers.get("x-forwarded-for") || "unknown_client";
    const limit = checkRateLimit(`pair_${clientIp}`, { maxRequests: 5, windowMs: 600000 });
    if (!limit.allowed) {
      return mt5Error(
        "RATE_LIMITED",
        "Too many pairing attempts. Please wait before retrying.",
        429,
        { reset_seconds: Math.ceil(limit.resetMs / 1000) }
      );
    }

    // 2. Parse & Validate Payload
    const body: MT5PairingRequest = await request.json().catch(() => ({}) as any);
    const { user_email, connector_name } = body;

    if (!user_email || typeof user_email !== "string" || !user_email.includes("@")) {
      return mt5Error("VALIDATION_ERROR", "Field 'user_email' is required and must be a valid email address.", 400);
    }

    // 3. Resolve User ID from Supabase Auth Users
    const supabase = await createAdminClient();
    const { data: usersData, error: userError } = await supabase.auth.admin.listUsers();

    if (userError || !usersData?.users) {
      return mt5Error("INTERNAL_ERROR", "Failed to query user records.", 500);
    }

    const targetUser = usersData.users.find(
      (u) => u.email?.toLowerCase().trim() === user_email.toLowerCase().trim()
    );

    if (!targetUser) {
      return mt5Error("USER_NOT_FOUND", `No TradeForge account found for email '${user_email}'.`, 444);
    }

    // 4. Register Connector & Issue API Key
    const { connector, apiKey, error: regError } = await MT5ConnectorService.registerConnector(
      targetUser.id,
      connector_name || "Desktop MT5 Terminal"
    );

    if (regError || !connector || !apiKey) {
      return mt5Error("REGISTRATION_FAILED", regError || "Failed to register connector.", 500);
    }

    const responsePayload: MT5PairingResponse = {
      connector_id: connector.id,
      api_key: apiKey,
      api_key_prefix: connector.api_key_prefix,
      connector_name: connector.connector_name,
      status: connector.status,
      created_at: connector.created_at,
    };

    return mt5Success(responsePayload, 201);
  } catch (err: any) {
    return mt5Error("INTERNAL_ERROR", err?.message || "An unexpected error occurred during pairing.", 500);
  }
}
