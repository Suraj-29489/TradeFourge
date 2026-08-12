import { NextRequest } from "next/server";
import { validateConnectorAuth } from "@/lib/api/mt5-auth";
import { mt5Success, mt5Error } from "@/lib/api/mt5-response";
import { checkRateLimit } from "@/lib/api/mt5-rate-limiter";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { liveStateStore, RawLiveStatePayload } from "@/lib/services/MT5LiveStateStore";

/**
 * POST /api/mt5/live
 * Connector endpoint: Ingests 1-5 second live account metrics and open positions snapshot.
 * Updates current account state in DB and holds transient position state in memory.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateConnectorAuth(request);
    if (!authResult.connector) {
      return mt5Error("UNAUTHORIZED", authResult.error || "Authentication failed.", authResult.status || 401);
    }

    const connector = authResult.connector;
    const connectorId = connector.connectorId;
    const userId = connector.userId;

    // Rate Limiting: 60 requests per 1 minute per connector (allows 1-2s updates safely)
    const rateLimit = checkRateLimit(`live_${connectorId}`, { maxRequests: 60, windowMs: 60000 });
    if (!rateLimit.allowed) {
      return mt5Error(
        "RATE_LIMITED",
        "Live update rate limit exceeded. Please throttle live sync interval.",
        429,
        { retry_after_seconds: Math.ceil(rateLimit.resetMs / 1000) }
      );
    }

    const body: RawLiveStatePayload = await request.json();

    if (!body || !body.account_number) {
      return mt5Error("VALIDATION_ERROR", "account_number is required in live payload.", 400);
    }

    const accountNumberStr = String(body.account_number).trim();
    const supabase = await createAdminClient();


    // 1. Resolve trading account ownership
    const { data: targetAccount } = await supabase
      .from("trading_accounts")
      .select("id, broker, server")
      .eq("user_id", userId)
      .or(`account_number.eq.${accountNumberStr},mt5_login_number.eq.${accountNumberStr}`)
      .limit(1)
      .maybeSingle();

    let accountId = targetAccount?.id;

    // 2. Update current account state metrics in PostgreSQL
    const nowISO = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      current_balance: Number(body.balance || 0),
      equity: Number(body.equity || 0),
      free_margin: Number(body.free_margin || 0),
      margin: Number(body.margin || 0),
      margin_level: body.margin_level !== undefined && body.margin_level !== null ? Number(body.margin_level) : null,
      is_connected: true,
      last_seen_at: nowISO,
      last_synced_at: nowISO,
      updated_at: nowISO,
    };

    if (accountId) {
      await supabase.from("trading_accounts").update(updatePayload).eq("id", accountId);
    }

    // 3. Store transient live positions & metrics in memory store
    const storedOk = liveStateStore.setLiveState(userId, connectorId, accountId, {
      ...body,
      account_number: accountNumberStr,
    });

    return mt5Success({
      status: storedOk ? "accepted" : "rejected_out_of_order",
      observed_at: body.observed_at || nowISO,
      received_at: nowISO,
    });
  } catch (err: any) {
    console.error("Error processing MT5 live payload:", err);
    return mt5Error("INTERNAL_ERROR", "Failed to process live state update.", 500);
  }
}

/**
 * GET /api/mt5/live
 * Frontend endpoint: Retrieves transient live open positions and account state for Live Workspace.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return mt5Error("UNAUTHORIZED", "Active user session required.", 401);
    }

    const { searchParams } = new URL(request.url);
    const queryAccountId = searchParams.get("account_id");
    const queryAccNum = searchParams.get("account_number");

    let targetAccNum = queryAccNum;
    let targetAccId = queryAccountId;

    // Resolve target account number / ID if needed
    if (!targetAccNum && targetAccId) {
      const { data: acc } = await supabase
        .from("trading_accounts")
        .select("id, account_number, mt5_login_number")
        .eq("user_id", user.id)
        .eq("id", targetAccId)
        .maybeSingle();

      if (acc) {
        targetAccNum = acc.account_number || acc.mt5_login_number || acc.id;
      }
    }

    if (!targetAccNum) {
      // Fallback: Pick first MT5 account for user
      const { data: acc } = await supabase
        .from("trading_accounts")
        .select("id, account_number, mt5_login_number")
        .eq("user_id", user.id)
        .or("platform.eq.MetaTrader 5,is_mt5_paired.eq.true")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (acc) {
        targetAccId = acc.id;
        targetAccNum = acc.account_number || acc.mt5_login_number || acc.id;
      }
    }

    if (!targetAccNum) {
      return mt5Success({
        account_id: null,
        account_number: null,
        observed_at: null,
        received_at: null,
        balance: 0,
        equity: 0,
        floating_pnl: 0,
        margin: 0,
        free_margin: 0,
        margin_level: null,
        is_connected: false,
        is_stale: true,
        last_update_sec_ago: -1,
        open_position_count: 0,
        positions: [],
      });
    }

    // Retrieve live state from transient store
    const { state, isStale, lastUpdateSecAgo } = liveStateStore.getLiveState(
      user.id,
      targetAccNum,
      10000 // 10s stale threshold
    );

    if (state) {
      return mt5Success({
        account_id: targetAccId || state.accountId || null,
        account_number: state.accountNumber,
        observed_at: state.observedAt,
        received_at: state.receivedAt,
        balance: state.balance,
        equity: state.equity,
        floating_pnl: state.floatingPnl,
        margin: state.margin,
        free_margin: state.freeMargin,
        margin_level: state.marginLevel,
        is_connected: !isStale,
        is_stale: isStale,
        last_update_sec_ago: lastUpdateSecAgo,
        open_position_count: state.positions.length,
        positions: state.positions,
      });
    }

    // Fallback if store has no live state yet: query DB account row
    const { data: dbAcc } = await supabase
      .from("trading_accounts")
      .select("*")
      .eq("user_id", user.id)
      .or(`account_number.eq.${targetAccNum},id.eq.${targetAccId}`)
      .maybeSingle();

    return mt5Success({
      account_id: dbAcc?.id || targetAccId || null,
      account_number: targetAccNum,
      observed_at: dbAcc?.last_seen_at || null,
      received_at: dbAcc?.last_seen_at || null,
      balance: Number(dbAcc?.current_balance ?? dbAcc?.starting_balance ?? 0),
      equity: Number(dbAcc?.equity ?? dbAcc?.current_balance ?? 0),
      floating_pnl: Number((dbAcc?.equity ?? 0) - (dbAcc?.current_balance ?? 0)),
      margin: Number(dbAcc?.margin ?? 0),
      free_margin: Number(dbAcc?.free_margin ?? 0),
      margin_level: dbAcc?.margin_level ? Number(dbAcc.margin_level) : null,
      is_connected: Boolean(dbAcc?.is_connected),
      is_stale: true,
      last_update_sec_ago: -1,
      open_position_count: 0,
      positions: [],
    });
  } catch (err: any) {
    console.error("Error retrieving MT5 live state:", err);
    return mt5Error("INTERNAL_ERROR", "Failed to retrieve live state.", 500);
  }
}
