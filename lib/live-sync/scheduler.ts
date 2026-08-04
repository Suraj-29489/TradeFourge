/**
 * TradeFourge v4.0.0 — Background Sync Scheduler
 * Schedules automated periodic background sync execution for live broker accounts.
 */

import { fetchLiveCredentials } from "@/lib/supabase/live-credentials";
import { runManualSync } from "./sync-engine";

export class SyncScheduler {
  private static timerId: any = null;
  private static activeUserId: string | null = null;

  public static startScheduler(userId: string): void {
    if (this.activeUserId === userId && this.timerId) return;

    this.stopScheduler();
    this.activeUserId = userId;

    this.timerId = setInterval(() => {
      this.tick(userId);
    }, 60000);

    this.tick(userId);
  }

  public static stopScheduler(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.activeUserId = null;
  }

  private static async tick(userId: string): Promise<void> {
    const { data: credentials } = await fetchLiveCredentials(userId);
    if (!credentials) return;

    const now = Date.now();

    for (const cred of credentials) {
      if (!cred.auto_sync) continue;

      const lastSync = cred.last_sync ? new Date(cred.last_sync).getTime() : 0;
      const intervalMs = 300000; // 5 minutes default

      if (now - lastSync >= intervalMs) {
        await runManualSync(cred);
      }
    }
  }
}
