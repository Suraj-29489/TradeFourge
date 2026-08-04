/**
 * TradeFourge v4.0.0 — Global Sync Manager
 * Manages active synchronization states and trigger methods across accounts.
 */

import { fetchLiveCredentials } from "@/lib/supabase/live-credentials";
import { runManualSync } from "./sync-engine";
import type { LiveBrokerCredential } from "@/types/database";

export class SyncManager {
  private static syncingAccounts = new Set<string>();

  public static isSyncing(credentialId: string): boolean {
    return this.syncingAccounts.has(credentialId);
  }

  public static async syncCredential(
    credential: LiveBrokerCredential
  ): Promise<{ success: boolean; imported: number; updated: number; skipped: number; error?: string }> {
    if (this.syncingAccounts.has(credential.id)) {
      return { success: false, imported: 0, updated: 0, skipped: 0, error: "Sync already in progress." };
    }

    try {
      this.syncingAccounts.add(credential.id);
      const result = await runManualSync(credential);
      return {
        success: result.success,
        imported: result.tradesImported,
        updated: 0,
        skipped: result.duplicatesSkipped,
        error: result.success ? undefined : result.message,
      };
    } finally {
      this.syncingAccounts.delete(credential.id);
    }
  }

  public static async syncAccount(
    userId: string,
    accountId: string
  ): Promise<{ success: boolean; imported: number; updated: number; skipped: number; error?: string }> {
    const { data: credentials } = await fetchLiveCredentials(userId);
    const targetCred = credentials?.find((c) => c.account_id === accountId || c.id === accountId);
    if (!targetCred) {
      return { success: false, imported: 0, updated: 0, skipped: 0, error: "Live credentials not found." };
    }
    return this.syncCredential(targetCred);
  }

  public static async syncAllUserAccounts(userId: string): Promise<void> {
    const { data: credentials } = await fetchLiveCredentials(userId);
    if (!credentials) return;
    for (const cred of credentials) {
      if (cred.auto_sync) {
        await this.syncCredential(cred);
      }
    }
  }
}
