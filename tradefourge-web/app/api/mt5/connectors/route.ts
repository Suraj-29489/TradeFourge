// app/api/mt5/connectors/route.ts
// GET /api/mt5/connectors — List user's registered MT5 Connectors.
// DELETE /api/mt5/connectors — Revoke an active MT5 Connector.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MT5ConnectorService } from "@/lib/services/MT5ConnectorService";

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

    const connectors = await MT5ConnectorService.getConnectorsForUser(userId);
    return NextResponse.json({ ok: true, data: connectors, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to fetch connectors" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    let connectorId = url.searchParams.get("connector_id") || url.searchParams.get("id");

    if (!connectorId) {
      const body = await request.json().catch(() => ({}));
      connectorId = body.connector_id || body.id;
    }

    if (!connectorId) {
      return NextResponse.json(
        { ok: false, error: "Missing required parameter 'connector_id'." },
        { status: 400 }
      );
    }

    const { success, error } = await MT5ConnectorService.revokeConnector(connectorId, userId);
    if (!success) {
      return NextResponse.json({ ok: false, error: error || "Failed to revoke connector" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "Connector revoked successfully.",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to process revocation" },
      { status: 500 }
    );
  }
}
