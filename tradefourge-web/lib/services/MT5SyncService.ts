// lib/services/MT5SyncService.ts
// Server-side Service for MT5 Account Metadata Sync and Idempotent Trade Batch Ingestion.
// Uses Supabase admin client for database persistence.

import { createAdminClient } from "@/lib/supabase/server";
import { mapMT5DealToCloudTrade } from "@/lib/api/mt5-trade-mapper";
import { generateAccountSlug } from "@/lib/account/account-identity";
import { generateDisplayAccountId } from "@/lib/supabase/frontend-store";
import type {
  MT5AccountSyncPayload,
  MT5AccountSyncResponse,
  MT5TradeBatchPayload,
  MT5TradeBatchResponse,
  MT5SyncBatchRecord,
} from "@/types/mt5-api";

export class MT5SyncService {
  /**
   * Synchronizes account metadata from MetaTrader 5 into `trading_accounts`.
   * Matches by (user_id, account_number, broker). Creates account if not existing.
   */
  static async syncAccounts(
    userId: string,
    connectorId: string,
    accounts: MT5AccountSyncPayload[]
  ): Promise<MT5AccountSyncResponse> {
    const supabase = await createAdminClient();
    const resultAccounts: MT5AccountSyncResponse["accounts"] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const acc of accounts) {
      const cleanNum = String(acc.account_number || "").trim();
      const broker = String(acc.broker || "MetaTrader 5 Broker").trim();
      const server = String(acc.server || "MT5 Server").trim();

      if (!cleanNum) continue;

      const nowISO = new Date().toISOString();

      // Check if account already exists matching (user_id, account_number, broker)
      const { data: existing } = await supabase
        .from("trading_accounts")
        .select("id, current_balance, mt5_server")
        .eq("user_id", userId)
        .eq("account_number", cleanNum)
        .eq("broker", broker)
        .limit(1);

      if (existing && existing.length > 0) {
        const targetAcc = existing[0];
        await supabase
          .from("trading_accounts")
          .update({
            current_balance: acc.balance,
            equity: acc.equity != null ? acc.equity : acc.balance,
            free_margin: acc.free_margin != null ? acc.free_margin : null,
            margin: acc.margin != null ? acc.margin : null,
            margin_level: acc.margin_level != null ? acc.margin_level : null,
            is_connected: true,
            last_seen_at: nowISO,
            connector_id: connectorId,
            mt5_server: server,
            is_mt5_paired: true,
            mt5_login_number: cleanNum,
            last_synced_at: nowISO,
            platform: "MetaTrader 5",
            currency: acc.currency || "USD",
            leverage: acc.leverage ? String(acc.leverage) : undefined,
            updated_at: nowISO,
          })
          .eq("id", targetAcc.id);

        updatedCount++;
        resultAccounts.push({
          account_number: cleanNum,
          server,
          account_id: targetAcc.id,
          action: "updated",
        });
      } else {
        // Create new trading account
        const accountName = acc.name
          ? `MT5 ${cleanNum} (${acc.name})`
          : `MT5 ${cleanNum} (${server})`;
        const slug = generateAccountSlug(accountName);
        const displayId = generateDisplayAccountId();

        const { data: newAcc, error } = await supabase
          .from("trading_accounts")
          .insert({
            user_id: userId,
            account_name: accountName,
            broker,
            platform: "MetaTrader 5",
            account_number: cleanNum,
            account_type: acc.account_type || "Live",
            currency: acc.currency || "USD",
            server,
            mt5_server: server,
            leverage: acc.leverage ? String(acc.leverage) : "1:100",
            starting_balance: acc.balance,
            current_balance: acc.balance,
            equity: acc.equity != null ? acc.equity : acc.balance,
            free_margin: acc.free_margin != null ? acc.free_margin : null,
            margin: acc.margin != null ? acc.margin : null,
            margin_level: acc.margin_level != null ? acc.margin_level : null,
            is_connected: true,
            last_seen_at: nowISO,
            display_id: displayId,
            slug,
            is_default: false,
            is_active: true,
            is_mt5_paired: true,
            mt5_login_number: cleanNum,
            connector_id: connectorId,
            last_synced_at: nowISO,
          })
          .select("id")
          .single();

        if (newAcc && !error) {
          createdCount++;
          resultAccounts.push({
            account_number: cleanNum,
            server,
            account_id: newAcc.id,
            action: "created",
          });
        }
      }
    }

    return {
      synced_total: resultAccounts.length,
      created_count: createdCount,
      updated_count: updatedCount,
      accounts: resultAccounts,
    };
  }

  /**
   * Processes an incoming trade batch from MetaTrader 5 idempotently.
   * Leverages the unique index `idx_trades_mt5_dedup` on (user_id, account_id, mt5_deal_id).
   */
  static async ingestTradeBatch(
    userId: string,
    connectorId: string,
    accountNumber: string,
    tradesPayload: MT5TradeBatchPayload[],
    batchType: "closed_trades" | "account_update" | "full_history" = "closed_trades",
    isReconciliation = false
  ): Promise<MT5TradeBatchResponse> {
    const startTime = Date.now();
    const startISO = new Date().toISOString();
    const supabase = await createAdminClient();

    // 1. Resolve trading account ID
    let accountId: string | null = null;
    const { data: accData } = await supabase
      .from("trading_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("account_number", accountNumber.trim())
      .limit(1);

    if (accData && accData.length > 0) {
      accountId = accData[0].id;
    } else {
      // Auto-provision basic trading account if not exists
      const displayId = generateDisplayAccountId();
      const accountName = `MT5 ${accountNumber}`;
      const { data: createdAcc } = await supabase
        .from("trading_accounts")
        .insert({
          user_id: userId,
          account_name: accountName,
          broker: "MetaTrader 5 Broker",
          platform: "MetaTrader 5",
          account_number: accountNumber.trim(),
          account_type: "Live",
          currency: "USD",
          display_id: displayId,
          slug: generateAccountSlug(accountName),
          connector_id: connectorId,
          is_mt5_paired: true,
          is_connected: true,
          last_seen_at: startISO,
          mt5_login_number: accountNumber.trim(),
          last_synced_at: startISO,
        })
        .select("id")
        .single();

      if (createdAcc) {
        accountId = createdAcc.id;
      }
    }

    if (!accountId) {
      throw new Error(`Failed to resolve trading account for account number ${accountNumber}`);
    }

    // 2. Create Audit Batch Entry with lifecycle timestamps
    const { data: batchObj } = await supabase
      .from("mt5_sync_batches")
      .insert({
        user_id: userId,
        connector_id: connectorId,
        account_id: accountId,
        batch_type: batchType,
        sync_type: "HISTORY",
        started_at: startISO,
        total_items: tradesPayload.length,
        inserted_count: 0,
        duplicate_count: 0,
        error_count: 0,
        status: "success",
      })
      .select("id")
      .single();

    const batchId = batchObj?.id || `batch_${Date.now()}`;

    // 3. Map and Validate Incoming Deals
    const validInsertBatch: any[] = [];
    const errorDetails: { deal_id: string; reason: string }[] = [];

    for (const dealPayload of tradesPayload) {
      const { validTrade, errorReason } = mapMT5DealToCloudTrade(
        dealPayload,
        userId,
        accountId,
        connectorId,
        batchId
      );

      if (errorReason || !validTrade) {
        errorDetails.push({
          deal_id: String(dealPayload.deal_id || "unknown"),
          reason: errorReason || "Validation failed",
        });
      } else {
        validInsertBatch.push({ ...validTrade, user_id: userId });
      }
    }

    let insertedCount = 0;
    let duplicateCount = 0;

    // 4. Batch Insert with Idempotent Deduplication
    if (validInsertBatch.length > 0) {
      const BATCH_CHUNK_SIZE = 100;
      for (let i = 0; i < validInsertBatch.length; i += BATCH_CHUNK_SIZE) {
        const chunk = validInsertBatch.slice(i, i + BATCH_CHUNK_SIZE);

        const { data: insertedData, error: insertErr } = await supabase
          .from("trades")
          .upsert(chunk, {
            onConflict: "user_id,account_id,mt5_deal_id",
            ignoreDuplicates: true,
          })
          .select("id");

        if (insertErr) {
          console.warn("[MT5SyncService] Chunk insert notice:", insertErr.message);
          // If bulk conflict occurs, fall back to individual insert to isolate duplicates
          for (const tradeItem of chunk) {
            const { data: singleIns, error: singleErr } = await supabase
              .from("trades")
              .upsert(tradeItem, {
                onConflict: "user_id,account_id,mt5_deal_id",
                ignoreDuplicates: true,
              })
              .select("id");

            if (singleErr) {
              errorDetails.push({
                deal_id: tradeItem.mt5_deal_id || "unknown",
                reason: singleErr.message,
              });
            } else if (singleIns && singleIns.length > 0) {
              insertedCount++;
            } else {
              duplicateCount++;
            }
          }
        } else {
          const chunkInserted = insertedData ? insertedData.length : 0;
          insertedCount += chunkInserted;
          duplicateCount += chunk.length - chunkInserted;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const completedISO = new Date().toISOString();
    const errorCount = errorDetails.length;
    const finalStatus = errorCount === 0 ? "success" : insertedCount > 0 ? "partial" : "failed";

    // 5. Update Audit Batch Entry & Account timestamps
    if (batchObj?.id) {
      await supabase
        .from("mt5_sync_batches")
        .update({
          inserted_count: insertedCount,
          duplicate_count: duplicateCount,
          error_count: errorCount,
          error_details: errorDetails,
          duration_ms: durationMs,
          status: finalStatus,
          completed_at: completedISO,
        })
        .eq("id", batchObj.id);
    }

    await supabase
      .from("trading_accounts")
      .update({
        last_synced_at: completedISO,
        last_history_sync_at: completedISO,
        last_seen_at: completedISO,
        is_connected: true,
        updated_at: completedISO,
      })
      .eq("id", accountId);

    return {
      batch_id: batchId,
      total_received: tradesPayload.length,
      inserted_count: insertedCount,
      duplicate_count: duplicateCount,
      reconciled_count: isReconciliation ? insertedCount : 0,
      error_count: errorCount,
      error_details: errorDetails,
      duration_ms: durationMs,
      status: finalStatus,
    };
  }

  /**
   * Retrieves paginated sync batch logs for frontend audit dashboard.
   */
  static async getSyncHistory(
    userId: string,
    limit = 50
  ): Promise<MT5SyncBatchRecord[]> {
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("mt5_sync_batches")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error || !data) return [];
      return data as MT5SyncBatchRecord[];
    } catch (err) {
      return [];
    }
  }
}
