// lib/live-sync/sync-manager.ts
// TradeFourge v4.0 Global Sync Manager
// Manages global active synchronization states and trigger methods.

import { fetchLiveCredentials } from "./account-linker";
import { executeAccountSync } from "./sync-service";
import type { LiveBrokerCredential } from "@/types/database";

export class SyncManager {
  private static syncingAccounts = new Set<string>();

  public static isSyncing(accountId: string): boolean {
    return this.syncingAccounts.has(accountId);
  }

  public static async syncAccount(
    userId: string,
    accountId: string
  ): Promise<{ success: boolean; imported: number; updated: number; skipped: number; error?: string }> {
    if (this.syncingAccounts.has(accountId)) {
      return { success: false, imported: 0, updated: 0, skipped: 0, error: "Sync already in progress." };
    }

    const credentials = fetchLiveCredentials(userId);
    const targetCred = credentials.find((c) => c.account_id === accountId);

    if (!targetCred) {
      return { success: false, imported: 0, updated: 0, skipped: 0, error: "Live credentials not found for account." };
    }

    try {
      this.syncingAccounts.add(accountId);
      const result = await executeAccountSync(targetCred);
      return result;
    } finally {
      this.syncingAccounts.delete(accountId);
    }
  }

  public static async syncAllUserAccounts(userId: string): Promise<void> {
    const credentials = fetchLiveCredentials(userId);
    for (const cred of credentials) {
      if (cred.sync_interval !== "manual") {
        await this.syncAccount(userId, cred.account_id);
      }
    }
  }
}
