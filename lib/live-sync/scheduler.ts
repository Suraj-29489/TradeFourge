// lib/live-sync/scheduler.ts
// TradeFourge v4.0 Background Sync Scheduler
// Schedules automated periodic background sync execution per user account independently from UI renders.

import { SyncManager } from "./sync-manager";
import { fetchLiveCredentials } from "./account-linker";

export class SyncScheduler {
  private static timerId: NodeJS.Timeout | null = null;
  private static activeUserId: string | null = null;

  public static startScheduler(userId: string): void {
    if (this.activeUserId === userId && this.timerId) return;

    this.stopScheduler();
    this.activeUserId = userId;

    // Run interval check every 30 seconds
    this.timerId = setInterval(() => {
      this.tick(userId);
    }, 30000);

    // Initial check on startup
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
    const credentials = fetchLiveCredentials(userId);
    const now = Date.now();

    for (const cred of credentials) {
      if (cred.sync_interval === "manual") continue;

      const lastSync = cred.last_sync_time ? new Date(cred.last_sync_time).getTime() : 0;
      let intervalMs = 300000; // default 5m

      if (cred.sync_interval === "1m") intervalMs = 60000;
      else if (cred.sync_interval === "5m") intervalMs = 300000;
      else if (cred.sync_interval === "15m") intervalMs = 900000;
      else if (cred.sync_interval === "1h") intervalMs = 3600000;

      if (now - lastSync >= intervalMs) {
        await SyncManager.syncAccount(userId, cred.account_id);
      }
    }
  }
}
