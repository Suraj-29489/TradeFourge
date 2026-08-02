"use client";
// context/UserProfileContext.tsx
// Single source of truth React Context for user profile, preferences, and trading accounts.
// Features TradeFourge v3.5.3 Resilient Architecture with Zero Render Loops & Isolated Failures.

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchUserProfile,
  updateUserProfile,
  fetchUserPreferences,
  updateUserPreferences,
  calculateProfileCompletion,
  DEFAULT_PROFILE,
  DEFAULT_PREFERENCES,
  type UserProfile,
  type UserPreferences,
} from "@/lib/supabase/profile";
import {
  fetchTradingAccounts,
  updateTradingAccount,
  createTradingAccount,
} from "@/lib/supabase/accounts";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useAppEventListener } from "@/lib/events/event-bus";
import type { TradingAccount, NewTradingAccount } from "@/types/database";

interface UserProfileContextType {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  accounts: TradingAccount[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
  loading: boolean;
  completionPct: number;
  refreshProfile: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  saveProfileUpdates: (updates: Partial<UserProfile>) => Promise<boolean>;
  savePreferenceUpdates: (updates: Partial<UserPreferences>) => Promise<{ success: boolean; error: string | null }>;
  addNewAccount: (payload: NewTradingAccount) => Promise<TradingAccount | null>;
}

const UserProfileContext = createContext<UserProfileContextType>({
  profile: null,
  preferences: null,
  accounts: [],
  selectedAccountIds: ["ALL"],
  setSelectedAccountIds: () => {},
  loading: true,
  completionPct: 20,
  refreshProfile: async () => {},
  refreshAccounts: async () => {},
  saveProfileUpdates: async () => false,
  savePreferenceUpdates: async () => ({ success: false, error: null }),
  addNewAccount: async () => null,
});

// Helper for selection state in localStorage
function getSelectionStorageKey(userId: string): string {
  const validUid = userId || "default_user";
  return `tf_selected_accounts_${validUid}`;
}

export function loadSelectedAccountsFromStorage(userId: string): string[] | null {
  if (typeof window === "undefined") return null;
  const key = getSelectionStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSelectedAccountsToStorage(userId: string, selectedIds: string[]): void {
  if (typeof window === "undefined") return;
  const key = getSelectionStorageKey(userId);
  try {
    const serialized = JSON.stringify(selectedIds);
    const existing = localStorage.getItem(key);
    if (existing === serialized) return; // Deduplicate localStorage writes
    localStorage.setItem(key, serialized);
  } catch (err) {
    console.error(`Failed to save selected accounts (${key}):`, err);
  }
}

// Dev Logger
const isDev = process.env.NODE_ENV === "development";
const devLog = (msg: string, type: "info" | "success" | "warn" | "error" = "info") => {
  if (!isDev) return;
  const prefix = "[Persistence]";
  if (type === "success") console.log(`%c${prefix} ✓ ${msg}`, "color: #10B981; font-weight: bold;");
  else if (type === "warn") console.warn(`%c${prefix} ⚠ ${msg}`, "color: #F59E0B; font-weight: bold;");
  else if (type === "error") console.error(`%c${prefix} ❌ ${msg}`, "color: #EF4444; font-weight: bold;");
  else console.log(`%c${prefix} ${msg}`, "color: #8B5CF6; font-weight: bold;");
};

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIdsState] = useState<string[]>(["ALL"]);
  const [loading, setLoading] = useState(true);

  const userIdRef = useRef<string | null>(null);
  const supabase = createClient();

  // Stable setSelectedAccountIds reference with ZERO external state dependencies
  const setSelectedAccountIds = useCallback((ids: string[], targetUid?: string) => {
    setSelectedAccountIdsState(ids);
    const store = useJournalStore.getState();
    store.setFilters((prev) => ({
      ...prev,
      accountIds: ids,
      accountId: ids.length === 1 ? ids[0] : "ALL",
    }));

    const uid = targetUid || userIdRef.current;
    if (uid) {
      saveSelectedAccountsToStorage(uid, ids);
    }
  }, []);

  // Stable loadAccounts reference
  const loadAccounts = useCallback(async (userId: string) => {
    try {
      const { data } = await fetchTradingAccounts(userId);
      const loaded = data ?? [];
      setAccounts(loaded);

      if (loaded.length === 1) {
        setSelectedAccountIds([loaded[0].id], userId);
      } else if (loaded.length > 1) {
        const saved = loadSelectedAccountsFromStorage(userId);
        if (saved && Array.isArray(saved) && saved.length > 0) {
          const validSaved = saved.includes("ALL")
            ? ["ALL"]
            : saved.filter((id) => loaded.some((a) => a.id === id));
          setSelectedAccountIds(validSaved.length > 0 ? validSaved : ["ALL"], userId);
        } else {
          setSelectedAccountIds(["ALL"], userId);
        }
      } else {
        setSelectedAccountIds([], userId);
      }
      devLog(`Loaded ${loaded.length} trading accounts for user ${userId}`, "success");
    } catch (err) {
      console.error("[Persistence] Failed to load trading accounts:", err);
      setAccounts([]);
      setSelectedAccountIds([], userId);
    }
  }, [setSelectedAccountIds]);

  // Stable loadCloudProfile reference
  const loadCloudProfile = useCallback(async () => {
    devLog("Loading Profile & Cloud Persistence Layer...", "info");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        userIdRef.current = null;
        setProfile(null);
        setPreferences(null);
        setAccounts([]);
        setSelectedAccountIdsState([]);
        return;
      }
      userIdRef.current = user.id;

      // 1. Self-Healing Profile Check
      let userProf = await fetchUserProfile(user.id);
      if (!userProf || !userProf.id) {
        devLog("Missing Profile → Creating Default Profile...", "warn");
        const defaultProfData = DEFAULT_PROFILE(user.id);
        const { data: healedProf } = await updateUserProfile(user.id, defaultProfData);
        userProf = healedProf || defaultProfData;
        devLog("Profile Self-Healing Complete", "success");
      }
      setProfile(userProf);

      // 2. Self-Healing Preferences Check
      let userPrefs = await fetchUserPreferences(user.id);
      if (!userPrefs) {
        devLog("Missing Preferences → Initializing Cloud Preferences...", "warn");
        const defaultPrefsData = DEFAULT_PREFERENCES(user.id);
        const { data: healedPrefs } = await updateUserPreferences(user.id, defaultPrefsData);
        userPrefs = healedPrefs || defaultPrefsData;
        devLog("Preferences Self-Healing Complete", "success");
      }
      setPreferences(userPrefs);

      // Synchronize Theme & Currency to Store
      const store = useJournalStore.getState();
      if (userPrefs?.default_chart_theme === "dark" || userPrefs?.default_chart_theme === "light") {
        store.setTheme(userPrefs.default_chart_theme as any);
      }
      if (userPrefs?.default_trade_currency) {
        store.setDisplayCurrency(userPrefs.default_trade_currency as any);
      }

      // 3. Self-Healing Account Integrity Check
      await loadAccounts(user.id);
      devLog("Complete — Persistence Guard Active", "success");
    } catch (err) {
      console.error("[Persistence] UserProfileProvider load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, loadAccounts]);

  // Mount effect running ONCE with empty dependency array []
  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (isMounted) await loadCloudProfile();
    }
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!isMounted) return;
      if (session?.user) {
        if (session.user.id !== userIdRef.current) {
          loadCloudProfile();
        }
      } else {
        userIdRef.current = null;
        setProfile(null);
        setPreferences(null);
        setAccounts([]);
        setSelectedAccountIdsState([]);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []); // Intentional empty dependency array: runs once on mount, zero re-execution loops

  const saveProfileUpdates = async (updates: Partial<UserProfile>): Promise<boolean> => {
    const targetUserId = profile?.id || userIdRef.current;
    if (!targetUserId) return false;
    const { data, error } = await updateUserProfile(targetUserId, updates);
    if (error) {
      console.error("[Persistence] saveProfileUpdates error:", error);
      return false;
    }
    if (data) {
      setProfile(data);
      devLog("Profile Updated & Synchronized", "success");
      return true;
    }
    return false;
  };

  const savePreferenceUpdates = async (updates: Partial<UserPreferences>): Promise<{ success: boolean; error: string | null }> => {
    let targetUserId = profile?.id || userIdRef.current;
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      targetUserId = user?.id;
    }
    if (!targetUserId) return { success: false, error: "User session not found. Please log in again." };

    devLog(`Saving preferences for user: ${targetUserId}`, "info");
    const { data, error } = await updateUserPreferences(targetUserId, updates);
    if (error) {
      devLog(`Preferences save failed: ${error}`, "error");
      console.error("[Persistence] savePreferenceUpdates Supabase error:", error);
      return { success: false, error };
    }
    if (data) {
      setPreferences(data);
      devLog("Preferences Updated & Synchronized", "success");
    }
    const store = useJournalStore.getState();
    if (updates.default_chart_theme) store.setTheme(updates.default_chart_theme as any);
    if (updates.default_trade_currency) store.setDisplayCurrency(updates.default_trade_currency as any);
    return { success: true, error: null };
  };

  const refreshAccounts = useCallback(async () => {
    let targetUserId = profile?.id || userIdRef.current;
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      targetUserId = user?.id;
    }
    if (targetUserId) {
      await loadAccounts(targetUserId);
    }
  }, [profile, loadAccounts, supabase]);

  const addNewAccount = async (payload: NewTradingAccount): Promise<TradingAccount | null> => {
    let targetUserId = profile?.id || userIdRef.current;
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      targetUserId = user?.id;
    }
    if (!targetUserId) return null;
    const { data, error } = await createTradingAccount(targetUserId, payload);
    if (data) {
      await loadAccounts(targetUserId);
      devLog(`New Account Added: "${data.account_name}"`, "success");
      return data;
    }
    if (error) console.error("addNewAccount error:", error);
    return null;
  };

  useAppEventListener(
    ["tradefourge:account-created", "tradefourge:account-updated", "tradefourge:account-deleted"],
    () => {
      refreshAccounts();
    }
  );

  const completionPct = profile ? calculateProfileCompletion(profile) : 20;

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        preferences,
        accounts,
        selectedAccountIds,
        setSelectedAccountIds: (ids: string[]) => setSelectedAccountIds(ids, userIdRef.current || undefined),
        loading,
        completionPct,
        refreshProfile: loadCloudProfile,
        refreshAccounts,
        saveProfileUpdates,
        savePreferenceUpdates,
        addNewAccount,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => useContext(UserProfileContext);
