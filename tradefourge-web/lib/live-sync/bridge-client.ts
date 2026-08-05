/**
 * TradeFourge v4.0.1 — Next.js Bridge API Client SDK
 * Communicates with the Python MT5 Bridge microservice for real live synchronization.
 */

import type { LiveBrokerCredential, SyncHistoryLog } from "@/types/database";

const BRIDGE_BASE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://localhost:8000";

export interface BridgeHealthStatus {
  status: "healthy" | "degraded" | "offline";
  version: string;
  uptime_seconds?: number;
  connected_brokers?: number;
  total_credentials?: number;
  system?: {
    cpu_percent: number;
    memory_used_mb: number;
    memory_percent: number;
  };
  last_sync?: string | null;
  last_failure?: string | null;
}

export async function checkBridgeHealth(): Promise<BridgeHealthStatus> {
  try {
    const res = await fetch(`${BRIDGE_BASE_URL}/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return { status: "offline", version: "4.0.1" };
    }
    return await res.json();
  } catch {
    return { status: "offline", version: "4.0.1" };
  }
}

export async function connectLiveAccountViaBridge(payload: {
  userId: string;
  accountId?: string;
  broker: string;
  platform: string;
  accountName: string;
  accountNumber: string;
  server: string;
  investorPassword: string;
  description?: string;
}): Promise<{ success: boolean; message: string; credential?: LiveBrokerCredential }> {
  try {
    const res = await fetch(`${BRIDGE_BASE_URL}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: payload.userId,
        account_id: payload.accountId,
        broker: payload.broker,
        platform: payload.platform,
        account_name: payload.accountName,
        account_number: payload.accountNumber,
        server: payload.server,
        investor_password: payload.investorPassword,
        description: payload.description,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.detail || "Bridge authentication failed." };
    }
    return { success: true, message: "Connected via MT5 Bridge.", credential: data };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to reach MT5 Bridge API." };
  }
}

export async function triggerManualSyncViaBridge(
  credentialId: string,
  userId: string
): Promise<{ success: boolean; message: string; tradesImported?: number; duplicatesSkipped?: number }> {
  try {
    const res = await fetch(`${BRIDGE_BASE_URL}/sync?credential_id=${encodeURIComponent(credentialId)}&user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.detail || "Manual sync failed on Bridge." };
    }
    return {
      success: data.success,
      message: data.message,
      tradesImported: data.trades_imported,
      duplicatesSkipped: data.duplicates_skipped,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Bridge API connection error." };
  }
}
