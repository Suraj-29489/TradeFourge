// app/api/mt5/sync-history/route.ts
// GET /api/mt5/sync-history — Retrieve audit log history of MT5 sync batches.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MT5SyncService } from "@/lib/services/MT5SyncService";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));

    const logs = await MT5SyncService.getSyncHistory(userId, limit);

    return NextResponse.json({
      ok: true,
      data: logs,
      total: logs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to fetch sync history logs" },
      { status: 500 }
    );
  }
}
