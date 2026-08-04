/**
 * TradeFourge v4.0.0 — Incremental Synchronization Engine
 * Orchestrates closed trade retrieval, duplicate suppression, Cloud DB persistence, and sync audit logging.
 */

import { createClient } from "@/lib/supabase/client";
import { fetchTrades, bulkInsertTrades } from "@/lib/supabase/trades";
import { updateLiveCredential, createSyncHistoryLog } from "@/lib/supabase/live-credentials";
import { validateMT5Credentials } from "./mt5-authenticator";
import { ExnessConnector } from "./exness-connector";
import { MT5Connector } from "./mt5-connector";
import { mapLivePayloadToNewTrade } from "./trade-merger";
import { emitAppEvent } from "@/lib/events/event-bus";
import type { LiveBrokerCredential, NewCloudTrade, CloudTrade } from "@/types/database";

export interface SyncExecutionResult {
  success: boolean;
  tradesImported: number;
  duplicatesSkipped: number;
  durationMs: number;
  status: "SUCCESS" | "WARNING" | "FAILED";
  message: string;
}

export async function runManualSync(
  credential: LiveBrokerCredential
): Promise<SyncExecutionResult> {
  const startTime = Date.now();
  const userId = credential.user_id;

  try {
    // 1. Mark status as Syncing
    await updateLiveCredential(credential.id, userId, { status: "Syncing" });

    // 2. Validate authentication
    const authResult = await validateMT5Credentials({
      broker: credential.broker,
      platform: credential.platform,
      accountNumber: credential.account_number,
      server: credential.server,
      encryptedPassword: credential.encrypted_password,
    });

    if (!authResult.success) {
      await updateLiveCredential(credential.id, userId, { status: authResult.status });
      const durationMs = Date.now() - startTime;
      await createSyncHistoryLog({
        user_id: userId,
        credential_id: credential.id,
        account_id: credential.account_id ?? null,
        broker: credential.broker,
        account_name: credential.account_name,
        sync_time: new Date().toISOString(),
        trades_imported: 0,
        duplicates_skipped: 0,
        duration_ms: durationMs,
        status: "FAILED",
        error_message: authResult.message,
      });

      return {
        success: false,
        tradesImported: 0,
        duplicatesSkipped: 0,
        durationMs,
        status: "FAILED",
        message: authResult.message,
      };
    }

    // 3. Select Connector
    const connector =
      credential.broker.toLowerCase() === "exness"
        ? new ExnessConnector()
        : new MT5Connector();

    await connector.authenticate({
      server: credential.server,
      loginNumber: credential.account_number,
      authSecret: credential.encrypted_password,
    });

    // 4. Incremental fetch: retrieve trades newer than last_closed_time
    const { closedTrades: rawPayloads } = await connector.fetchIncrementalTrades(
      credential.last_closed_time ?? null
    );

    // 5. Duplicate Protection: Fetch existing trades for user to compare tickets
    const { data: existingTradesRes } = await fetchTrades(
      userId,
      { accountId: credential.account_id ?? "ALL", dateRange: "ALL" },
      1,
      10000
    );
    const existingTrades: CloudTrade[] = existingTradesRes?.data ?? [];
    const existingTicketSet = new Set(
      existingTrades.map((t) => t.ticket).filter(Boolean)
    );

    const tradesToInsert: NewCloudTrade[] = [];
    let duplicatesSkipped = 0;
    let latestTicket: string | null = credential.last_imported_ticket ?? null;
    let latestClosedTime: string | null = credential.last_closed_time ?? null;

    for (const raw of rawPayloads) {
      if (raw.ticket && existingTicketSet.has(raw.ticket)) {
        duplicatesSkipped++;
        continue;
      }

      tradesToInsert.push(
        mapLivePayloadToNewTrade(userId, credential.account_id ?? "", raw)
      );

      if (raw.ticket) latestTicket = raw.ticket;
      if (raw.closeTime) latestClosedTime = raw.closeTime;
    }

    // 6. Bulk Insert Unique Cloud Trades
    let tradesImported = 0;
    if (tradesToInsert.length > 0) {
      const insertRes = await bulkInsertTrades(userId, tradesToInsert);
      tradesImported = insertRes.inserted;
      duplicatesSkipped += insertRes.skippedDuplicates;
    }

    const durationMs = Date.now() - startTime;
    const now = new Date().toISOString();

    // 7. Update Live Broker Credential status & metrics
    const newTotalTrades = (credential.total_trades || 0) + tradesImported;
    await updateLiveCredential(credential.id, userId, {
      status: "Connected",
      last_sync: now,
      last_imported_ticket: latestTicket,
      last_closed_time: latestClosedTime || now,
      total_trades: newTotalTrades,
    });

    // 8. Record Sync Log in sync_history
    await createSyncHistoryLog({
      user_id: userId,
      credential_id: credential.id,
      account_id: credential.account_id ?? null,
      broker: credential.broker,
      account_name: credential.account_name,
      sync_time: now,
      trades_imported: tradesImported,
      duplicates_skipped: duplicatesSkipped,
      duration_ms: durationMs,
      status: "SUCCESS",
      log_details: {
        server: credential.server,
        accountNumber: credential.account_number,
        incrementalCount: rawPayloads.length,
      },
    });

    // 9. Notify app listeners to refresh charts and tables
    emitAppEvent("tradefourge:trade-created", { tradeId: `sync-${Date.now()}` });

    return {
      success: true,
      tradesImported,
      duplicatesSkipped,
      durationMs,
      status: "SUCCESS",
      message: `Sync completed cleanly. ${tradesImported} trades imported, ${duplicatesSkipped} duplicates skipped in ${durationMs}ms.`,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errMsg = err?.message || "Incremental sync execution error.";
    await updateLiveCredential(credential.id, userId, { status: "Error" });

    await createSyncHistoryLog({
      user_id: userId,
      credential_id: credential.id,
      account_id: credential.account_id ?? null,
      broker: credential.broker,
      account_name: credential.account_name,
      sync_time: new Date().toISOString(),
      trades_imported: 0,
      duplicates_skipped: 0,
      duration_ms: durationMs,
      status: "FAILED",
      error_message: errMsg,
    });

    return {
      success: false,
      tradesImported: 0,
      duplicatesSkipped: 0,
      durationMs,
      status: "FAILED",
      message: errMsg,
    };
  }
}
