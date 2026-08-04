/**
 * TradeFourge v4.0.0 — Account Sync Execution Service
 * Orchestrates the synchronization cycle for a specific live broker account.
 */

import { runManualSync } from "./sync-engine";
import type { LiveBrokerCredential } from "@/types/database";

export async function executeAccountSync(
  credential: LiveBrokerCredential
): Promise<{
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  error?: string;
}> {
  const res = await runManualSync(credential);
  return {
    success: res.success,
    imported: res.tradesImported,
    updated: 0,
    skipped: res.duplicatesSkipped,
    error: res.success ? undefined : res.message,
  };
}
