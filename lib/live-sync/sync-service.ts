// lib/live-sync/sync-service.ts
// TradeFourge v4.0 Single Account Sync Execution Service
// Orchestrates the synchronization cycle for a specific live broker account.

import { createClient } from "@/lib/supabase/client";
import { fetchTrades, createTrade, updateTrade } from "@/lib/supabase/trades";
import { updateTradingAccount, fetchTradingAccountById } from "@/lib/supabase/accounts";
import { ExnessConnector } from "./exness-connector";
import { MT5Connector } from "./mt5-connector";
import { ConflictResolver } from "./conflict-resolver";
import { mapLivePayloadToNewTrade } from "./trade-merger";
import { resolveBrokerCurrency } from "./currency-resolver";
import { recordSyncLog } from "./sync-history";
import { updateCredentialStatus } from "./account-linker";
import { RetryManager } from "./retry-manager";
import type { LiveBrokerCredential, CloudTrade } from "@/types/database";

export async function executeAccountSync(
  credential: LiveBrokerCredential
): Promise<{
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  error?: string;
}> {
  const startTime = Date.now();
  const supabase = createClient();
  const userId = credential.user_id;
  const accountId = credential.account_id;

  try {
    // 1. Select Connector
    const connector =
      credential.broker_id.toLowerCase() === "exness"
        ? new ExnessConnector()
        : new MT5Connector();

    // 2. Authenticate securely
    const authSuccess = await connector.authenticate({
      server: credential.server,
      loginNumber: credential.login_number,
      authSecret: credential.encrypted_auth_ref,
    });

    if (!authSuccess) {
      const errMsg = "Authentication failed. Check broker server and credentials.";
      updateCredentialStatus(userId, accountId, "Error", errMsg);
      recordSyncLog(userId, {
        user_id: userId,
        account_id: accountId,
        account_name: credential.broker_name,
        broker: credential.broker_name,
        timestamp: new Date().toISOString(),
        trades_imported: 0,
        trades_updated: 0,
        trades_skipped: 0,
        duration_ms: Date.now() - startTime,
        status: "FAILED",
        error_message: errMsg,
      });
      return { success: false, imported: 0, updated: 0, skipped: 0, error: errMsg };
    }

    // 3. Update status to Syncing
    updateCredentialStatus(userId, accountId, "Syncing");

    // 4. Fetch Account Summary (Currency, Balance, Equity)
    const summary = await connector.fetchAccountSummary();
    const resolvedCurrency = resolveBrokerCurrency(summary.currency);

    // Update Trading Account Balance and Currency automatically
    const { data: existingAccount } = await fetchTradingAccountById(accountId, userId);
    if (existingAccount) {
      await updateTradingAccount(accountId, userId, {
        currency: resolvedCurrency,
        current_balance: summary.balance,
        is_live_synced: true,
        live_status: "Connected",
        last_synced_at: new Date().toISOString(),
      });
    }

    // 5. Fetch Existing Trades for Account
    const { data: tradesRes } = await fetchTrades(
      userId,
      { accountId, accountIds: [accountId], dateRange: "ALL", search: "", side: "ALL", outcome: "ALL", source: "ALL", session: "ALL" },
      1,
      10000
    );
    const existingTrades: CloudTrade[] = tradesRes?.data ?? [];

    // 6. Fetch Incremental Trades
    const { closedTrades } = await connector.fetchIncrementalTrades(credential.last_sync_time);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    // 7. Resolve Conflicts & Merge Trades
    for (const payload of closedTrades) {
      const evaluation = ConflictResolver.evaluateTradeConflict(payload, existingTrades);

      if (evaluation.action === "IMPORT") {
        const newTradeData = mapLivePayloadToNewTrade(userId, accountId, payload);
        const { error: insertErr } = await createTrade(userId, newTradeData);
        if (!insertErr) imported++;
      } else if (evaluation.action === "UPDATE" && evaluation.existingTradeId) {
        const updatedTradeData = mapLivePayloadToNewTrade(userId, accountId, payload);
        const { error: updateErr } = await updateTrade(evaluation.existingTradeId, userId, updatedTradeData);
        if (!updateErr) updated++;
      } else {
        skipped++;
      }
    }

    // 8. Update Credentials & Record Log
    updateCredentialStatus(userId, accountId, "Connected");
    RetryManager.resetAttempts(accountId);

    recordSyncLog(userId, {
      user_id: userId,
      account_id: accountId,
      account_name: existingAccount?.account_name || summary.accountName,
      broker: credential.broker_name,
      timestamp: new Date().toISOString(),
      trades_imported: imported,
      trades_updated: updated,
      trades_skipped: skipped,
      duration_ms: Date.now() - startTime,
      status: "SUCCESS",
    });

    return { success: true, imported, updated, skipped };
  } catch (err: any) {
    const errMsg = err?.message || "Live synchronization failed.";
    updateCredentialStatus(userId, accountId, "Error", errMsg);

    recordSyncLog(userId, {
      user_id: userId,
      account_id: accountId,
      account_name: credential.broker_name,
      broker: credential.broker_name,
      timestamp: new Date().toISOString(),
      trades_imported: 0,
      trades_updated: 0,
      trades_skipped: 0,
      duration_ms: Date.now() - startTime,
      status: "FAILED",
      error_message: errMsg,
    });

    return { success: false, imported: 0, updated: 0, skipped: 0, error: errMsg };
  }
}
