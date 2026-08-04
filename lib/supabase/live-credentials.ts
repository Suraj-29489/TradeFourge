/**
 * Supabase Service for live_broker_credentials and sync_history tables
 * TradeFourge v4.0.0 Live Broker Sync
 */

import { createClient } from "./client";
import { isFrontendOnly } from "@/lib/config/frontend-only";
import { encryptPassword } from "@/lib/live-sync/encryption";
import type {
  LiveBrokerCredential,
  NewLiveBrokerCredential,
  SyncHistoryLog,
  ServiceResult,
} from "@/types/database";

const LOCAL_STORAGE_CRED_KEY = "tf_live_broker_credentials";
const LOCAL_STORAGE_SYNC_KEY = "tf_sync_history_logs";

// ─── Local Fallback Utilities ───────────────────────────────────────────────

function getLocalCredentials(userId: string): LiveBrokerCredential[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CRED_KEY);
    const list: LiveBrokerCredential[] = raw ? JSON.parse(raw) : [];
    return list.filter((c) => c.user_id === userId);
  } catch {
    return [];
  }
}

function saveLocalCredentials(creds: LiveBrokerCredential[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_CRED_KEY, JSON.stringify(creds));
  } catch {}
}

function getLocalSyncLogs(userId: string): SyncHistoryLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SYNC_KEY);
    const list: SyncHistoryLog[] = raw ? JSON.parse(raw) : [];
    return list.filter((l) => l.user_id === userId);
  } catch {
    return [];
  }
}

function saveLocalSyncLogs(logs: SyncHistoryLog[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_SYNC_KEY, JSON.stringify(logs));
  } catch {}
}

// ─── Credentials Service ────────────────────────────────────────────────────

export async function fetchLiveCredentials(
  userId: string
): Promise<ServiceResult<LiveBrokerCredential[]>> {
  if (isFrontendOnly()) {
    return { data: getLocalCredentials(userId), error: null };
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("live_broker_credentials")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      // Fallback to local
      return { data: getLocalCredentials(userId), error: null };
    }
    return { data: data ?? [], error: null };
  } catch {
    return { data: getLocalCredentials(userId), error: null };
  }
}

export async function createLiveCredential(
  userId: string,
  payload: NewLiveBrokerCredential
): Promise<ServiceResult<LiveBrokerCredential>> {
  const encryptedPassword = encryptPassword(payload.encrypted_password);
  const now = new Date().toISOString();

  const newCredential: LiveBrokerCredential = {
    id: `cred-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: userId,
    broker: payload.broker,
    platform: payload.platform || "MetaTrader 5",
    account_name: payload.account_name,
    account_number: payload.account_number,
    server: payload.server,
    encrypted_password: encryptedPassword,
    status: payload.status || "Connected",
    auto_sync: payload.auto_sync ?? true,
    total_trades: 0,
    created_at: now,
    updated_at: now,
  };

  if (isFrontendOnly()) {
    const current = getLocalCredentials(userId);
    const updated = [newCredential, ...current];
    saveLocalCredentials(updated);
    return { data: newCredential, error: null };
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("live_broker_credentials")
      .insert({
        user_id: userId,
        account_id: payload.account_id ?? null,
        broker: payload.broker,
        platform: payload.platform || "MetaTrader 5",
        account_name: payload.account_name,
        account_number: payload.account_number,
        server: payload.server,
        encrypted_password: encryptedPassword,
        status: payload.status || "Connected",
        auto_sync: payload.auto_sync ?? true,
      })
      .select()
      .single();

    if (error) {
      // Fallback local save
      const current = getLocalCredentials(userId);
      saveLocalCredentials([newCredential, ...current]);
      return { data: newCredential, error: null };
    }

    return { data, error: null };
  } catch {
    const current = getLocalCredentials(userId);
    saveLocalCredentials([newCredential, ...current]);
    return { data: newCredential, error: null };
  }
}

export async function updateLiveCredential(
  id: string,
  userId: string,
  updates: Partial<LiveBrokerCredential>
): Promise<ServiceResult<LiveBrokerCredential>> {
  if (isFrontendOnly()) {
    const current = getLocalCredentials(userId);
    let updatedObj: LiveBrokerCredential | null = null;
    const updatedList = current.map((c) => {
      if (c.id === id) {
        updatedObj = { ...c, ...updates, updated_at: new Date().toISOString() };
        return updatedObj;
      }
      return c;
    });
    saveLocalCredentials(updatedList);
    return { data: updatedObj, error: updatedObj ? null : "Credential not found" };
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("live_broker_credentials")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update credential";
    return { data: null, error: message };
  }
}

export async function deleteLiveCredential(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  if (isFrontendOnly()) {
    const current = getLocalCredentials(userId);
    saveLocalCredentials(current.filter((c) => c.id !== id));
    return { data: true, error: null };
  }

  const supabase = createClient();
  try {
    const { error } = await supabase
      .from("live_broker_credentials")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) return { data: false, error: error.message };
    return { data: true, error: null };
  } catch {
    const current = getLocalCredentials(userId);
    saveLocalCredentials(current.filter((c) => c.id !== id));
    return { data: true, error: null };
  }
}

// ─── Sync History Service ───────────────────────────────────────────────────

export async function fetchSyncHistoryLogs(
  userId: string
): Promise<ServiceResult<SyncHistoryLog[]>> {
  if (isFrontendOnly()) {
    return { data: getLocalSyncLogs(userId), error: null };
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("sync_history")
      .select("*")
      .eq("user_id", userId)
      .order("sync_time", { ascending: false });

    if (error) {
      return { data: getLocalSyncLogs(userId), error: null };
    }
    return { data: data ?? [], error: null };
  } catch {
    return { data: getLocalSyncLogs(userId), error: null };
  }
}

export async function createSyncHistoryLog(
  payload: Omit<SyncHistoryLog, "id" | "created_at">
): Promise<ServiceResult<SyncHistoryLog>> {
  const newLog: SyncHistoryLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...payload,
    created_at: new Date().toISOString(),
  };

  if (isFrontendOnly()) {
    const current = getLocalSyncLogs(payload.user_id);
    saveLocalSyncLogs([newLog, ...current]);
    return { data: newLog, error: null };
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("sync_history")
      .insert(payload)
      .select()
      .single();

    if (error) {
      const current = getLocalSyncLogs(payload.user_id);
      saveLocalSyncLogs([newLog, ...current]);
      return { data: newLog, error: null };
    }
    return { data, error: null };
  } catch {
    const current = getLocalSyncLogs(payload.user_id);
    saveLocalSyncLogs([newLog, ...current]);
    return { data: newLog, error: null };
  }
}
