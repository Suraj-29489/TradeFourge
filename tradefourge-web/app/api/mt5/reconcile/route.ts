// app/api/mt5/reconcile/route.ts
// POST /api/mt5/reconcile — Endpoint to trigger historical trade reconciliation.

import { NextRequest } from "next/server";
import { mt5Success, mt5Error } from "@/lib/api/mt5-response";
import { checkRateLimit } from "@/lib/api/mt5-rate-limiter";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabaseUser = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabaseUser.auth.getUser();

    if (userErr || !user) {
      return mt5Error("UNAUTHORIZED", "Authentication required to trigger reconciliation.", 401);
    }

    const userId = user.id;

    // Rate Limiting: Max 5 reconciliation triggers per minute per user
    const rateLimit = checkRateLimit(`reconcile_${userId}`, { maxRequests: 5, windowMs: 60000 });
    if (!rateLimit.allowed) {
      return mt5Error(
        "RATE_LIMITED",
        "Reconciliation rate limit exceeded. Please wait before triggering again.",
        429
      );
    }

    const body = await request.json().catch(() => ({}));
    const { account_id, account_number, days = 30 } = body;

    const supabaseAdmin = await createAdminClient();

    // Resolve trading account
    let query = supabaseAdmin.from("trading_accounts").select("id, account_number, is_connected, live_status").eq("user_id", userId);

    if (account_id) {
      query = query.eq("id", account_id);
    } else if (account_number) {
      query = query.eq("account_number", String(account_number).trim());
    }

    const { data: accounts } = await query.limit(1);

    if (!accounts || accounts.length === 0) {
      return mt5Error("NOT_FOUND", "Specified trading account not found.", 404);
    }

    const targetAccount = accounts[0];

    if (targetAccount.live_status === "Reconciling") {
      return mt5Success(
        {
          account_id: targetAccount.id,
          account_number: targetAccount.account_number,
          status: "already_running",
          message: "Reconciliation is already in progress for this account.",
        },
        200
      );
    }

    // Flag account as Reconciling
    const nowISO = new Date().toISOString();
    await supabaseAdmin
      .from("trading_accounts")
      .update({
        live_status: "Reconciling",
        updated_at: nowISO,
      })
      .eq("id", targetAccount.id);

    return mt5Success(
      {
        account_id: targetAccount.id,
        account_number: targetAccount.account_number,
        status: "initiated",
        reconciliation_window_days: days,
        message: `Historical reconciliation initiated for account ${targetAccount.account_number} (${days} days window).`,
      },
      200
    );
  } catch (err: any) {
    return mt5Error("INTERNAL_ERROR", err?.message || "Failed to trigger reconciliation.", 500);
  }
}
