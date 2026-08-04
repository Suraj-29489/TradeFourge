/**
 * TradeFourge v4.0.0 — Sync History Audit Service
 * Records and retrieves detailed synchronization audit logs.
 */

import type { SyncLogEntry } from "@/types/database";

function getStorageKey(userId: string): string {
  return `tf_sync_history_${userId || "default_user"}`;
}

export function fetchSyncHistory(userId: string): SyncLogEntry[] {
  if (typeof window === "undefined") return [];
  const key = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordSyncLog(userId: string, entry: Omit<SyncLogEntry, "id" | "created_at">): SyncLogEntry {
  const fullEntry: SyncLogEntry = {
    ...entry,
    id: `SYNC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    created_at: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    const key = getStorageKey(userId);
    const existing = fetchSyncHistory(userId);
    const updated = [fullEntry, ...existing].slice(0, 100);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (err) {
      console.error("[SyncHistory] Failed to record sync log:", err);
    }
  }

  return fullEntry;
}

export function clearSyncHistory(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getStorageKey(userId));
  } catch {}
}
