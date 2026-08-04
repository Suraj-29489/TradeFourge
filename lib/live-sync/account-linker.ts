// lib/live-sync/account-linker.ts
// TradeFourge v4.0 Account Linker & Credentials Service
// Manages secure credential binding and account connection persistence without storing plain text passwords in logs.

import type { LiveBrokerCredential, SyncIntervalSetting, AccountPlatform } from "@/types/database";

function getCredentialsStorageKey(userId: string): string {
  return `tf_live_credentials_${userId || "default_user"}`;
}

export function fetchLiveCredentials(userId: string): LiveBrokerCredential[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getCredentialsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLiveCredential(
  userId: string,
  credential: Omit<LiveBrokerCredential, "id" | "created_at" | "updated_at">
): LiveBrokerCredential {
  const existing = fetchLiveCredentials(userId);
  const now = new Date().toISOString();

  const id = `CRED-${Date.now()}`;
  const newCred: LiveBrokerCredential = {
    ...credential,
    id,
    created_at: now,
    updated_at: now,
  };

  // Replace if existing for same account_id, else append
  const filtered = existing.filter((c) => c.account_id !== credential.account_id);
  const updated = [newCred, ...filtered];

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getCredentialsStorageKey(userId), JSON.stringify(updated));
    } catch (err) {
      console.error("[AccountLinker] Failed to save credential:", err);
    }
  }

  return newCred;
}

export function updateCredentialStatus(
  userId: string,
  accountId: string,
  status: LiveBrokerCredential["status"],
  lastError: string | null = null
): void {
  const existing = fetchLiveCredentials(userId);
  const target = existing.find((c) => c.account_id === accountId);
  if (!target) return;

  target.status = status;
  target.updated_at = new Date().toISOString();
  if (status === "Connected") {
    target.last_sync = new Date().toISOString();
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getCredentialsStorageKey(userId), JSON.stringify(existing));
    } catch (err) {
      console.error("[AccountLinker] Failed to update credential status:", err);
    }
  }
}
