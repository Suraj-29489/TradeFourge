"use client";
// context/UserProfileContext.tsx
// Single source of truth React Context for user profile, preferences, and trading accounts.
// Features TradeFourge v3.2.6.1 Persistence Guard & Self-Healing Layer.

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
import type { TradingAccount, NewTradingAccount } from "@/types/database";

interface UserProfileContextType {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  accounts: TradingAccount[];
  defaultAccount: TradingAccount | null;
  loading: boolean;
  completionPct: number;
  refreshProfile: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  saveProfileUpdates: (updates: Partial<UserProfile>) => Promise<boolean>;
  savePreferenceUpdates: (updates: Partial<UserPreferences>) => Promise<{ success: boolean; error: string | null }>;
  switchDefaultAccount: (accountId: string) => Promise<boolean>;
  addNewAccount: (payload: NewTradingAccount) => Promise<TradingAccount | null>;
}

const UserProfileContext = createContext<UserProfileContextType>({
  profile: null,
  preferences: null,
  accounts: [],
  defaultAccount: null,
  loading: true,
  completionPct: 20,
  refreshProfile: async () => {},
  refreshAccounts: async () => {},
  saveProfileUpdates: async () => false,
  savePreferenceUpdates: async () => ({ success: false, error: null }),
  switchDefaultAccount: async () => false,
  addNewAccount: async () => null,
});

// Structured Dev-only Logger
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
  const [defaultAccount, setDefaultAccount] = useState<TradingAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  // ── Self-Healing Trading Accounts Integrity Check ────────────────────────
  const loadAccounts = useCallback(async (userId: string) => {
    try {
      const { data } = await fetchTradingAccounts(userId);
      if (data && data.length > 0) {
        setAccounts(data);
        const def = data.find((a) => a.is_default) || data[0];
        setDefaultAccount(def);
        devLog(`Trading Account Loaded: "${def.account_name}"`, "success");
      } else {
        // Self-Healing: Missing trading account -> Automatically create main trading account
        devLog("Missing Trading Account → Creating Default Main Trading Account...", "warn");
        const { data: newAcc } = await createTradingAccount(userId, {
          account_name: "Main Trading Account",
          broker: "Standard Broker",
          platform: "Other",
          account_number: null,
          account_type: "Live",
          currency: "USD",
          leverage: null,
          starting_balance: 10000,
          current_balance: 10000,
          is_default: true,
          is_active: true,
          notes: null,
        });

        if (newAcc) {
          setAccounts([newAcc]);
          setDefaultAccount(newAcc);
          devLog("Trading Account Self-Healing Complete", "success");
        } else {
          setAccounts([]);
          setDefaultAccount(null);
        }
      }
    } catch (err) {
      console.error("[Persistence] Failed to load trading accounts:", err);
      setAccounts([]);
      setDefaultAccount(null);
    }
  }, []);

  // ── Self-Healing Integrity Check Execution ─────────────────────────────────
  const loadCloudProfile = useCallback(async () => {
    devLog("Loading Profile & Cloud Persistence Layer...", "info");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 1. Self-Healing Profile Check
        let userProf = await fetchUserProfile(user.id);
        if (!userProf || !userProf.id) {
          devLog("Missing Profile → Creating Default Profile...", "warn");
          const defaultProfData = DEFAULT_PROFILE(user.id);
          const { data: healedProf } = await updateUserProfile(user.id, defaultProfData);
          userProf = healedProf || defaultProfData;
          devLog("Profile Self-Healing Complete", "success");
        } else {
          devLog("Profile Loaded", "success");
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
        } else {
          devLog("Preferences Loaded", "success");
        }
        setPreferences(userPrefs);

        // Synchronize Theme & Currency to Store
        const store = useJournalStore.getState();
        if (userPrefs.default_chart_theme === "dark" || userPrefs.default_chart_theme === "light") {
          store.setTheme(userPrefs.default_chart_theme as any);
        }
        if (userPrefs.default_trade_currency) {
          store.setDisplayCurrency(userPrefs.default_trade_currency as any);
        }

        // 3. Self-Healing Account Integrity Check
        await loadAccounts(user.id);
        devLog("Complete — Persistence Guard Active", "success");
      }
    } catch (err) {
      console.error("[Persistence] UserProfileProvider load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [loadAccounts]);

  useEffect(() => {
    loadCloudProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) {
        loadCloudProfile();
      } else {
        setProfile(null);
        setPreferences(null);
        setAccounts([]);
        setDefaultAccount(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadCloudProfile]);

  const saveProfileUpdates = async (updates: Partial<UserProfile>): Promise<boolean> => {
    if (!profile) return false;
    const { data, error } = await updateUserProfile(profile.id, updates);
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
    let targetUserId = profile?.id;
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

  const switchDefaultAccount = async (accountId: string): Promise<boolean> => {
    if (!profile) return false;
    const { data } = await updateTradingAccount(accountId, profile.id, { is_default: true });
    if (data) {
      await loadAccounts(profile.id);
      devLog("Default Account Switched", "success");
      return true;
    }
    return false;
  };

  const addNewAccount = async (payload: NewTradingAccount): Promise<TradingAccount | null> => {
    if (!profile) return null;
    const { data } = await createTradingAccount(profile.id, payload);
    if (data) {
      await loadAccounts(profile.id);
      devLog(`New Account Added: "${data.account_name}"`, "success");
      return data;
    }
    return null;
  };

  const completionPct = profile ? calculateProfileCompletion(profile) : 20;

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        preferences,
        accounts,
        defaultAccount,
        loading,
        completionPct,
        refreshProfile: loadCloudProfile,
        refreshAccounts: async () => {
          if (profile) await loadAccounts(profile.id);
        },
        saveProfileUpdates,
        savePreferenceUpdates,
        switchDefaultAccount,
        addNewAccount,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => useContext(UserProfileContext);
