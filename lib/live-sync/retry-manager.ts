// lib/live-sync/retry-manager.ts
// TradeFourge v4.0 Exponential Backoff Retry Manager
// Manages automated connection retries with backoff intervals: 10s -> 30s -> 60s -> 5m.

export class RetryManager {
  private static attemptsMap = new Map<string, number>();

  public static getNextDelayMs(accountId: string): number {
    const attempts = this.attemptsMap.get(accountId) || 0;
    this.attemptsMap.set(accountId, attempts + 1);

    switch (attempts + 1) {
      case 1:
        return 10000; // 10 sec
      case 2:
        return 30000; // 30 sec
      case 3:
        return 60000; // 60 sec
      case 4:
        return 300000; // 5 min
      default:
        return 300000; // Cap at 5 min
    }
  }

  public static resetAttempts(accountId: string): void {
    this.attemptsMap.delete(accountId);
  }

  public static getAttemptCount(accountId: string): number {
    return this.attemptsMap.get(accountId) || 0;
  }
}
