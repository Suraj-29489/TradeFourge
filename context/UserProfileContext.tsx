"use client";
// context/UserProfileContext.tsx
// Single source of truth React Context for user profile, preferences, and trading accounts.
// Synchronizes avatar, full_name, username, country, timezone, currency, and default trading account globally.

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchUserProfile,
  updateUserProfile,
  fetchUserPreferences,
  updateUserPreferences,
  calculateProfileCompletion,
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
  savePreferenceUpdates: (updates: Partial<UserPreferences>) => Promise<boolean>;
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
  savePreferenceUpdates: async () => false,
  switchDefaultAccount: async () => false,
  addNewAccount: async () => null,
});

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [defaultAccount, setDefaultAccount] = useState<TradingAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadAccounts = useCallback(async (userId: string) => {
    try {
      const { data } = await fetchTradingAccounts(userId);
      if (data && data.length > 0) {
        setAccounts(data);
        const def = data.find((a) => a.is_default) || data[0];
        setDefaultAccount(def);
      } else {
        setAccounts([]);
        setDefaultAccount(null);
      }
    } catch (err) {
      console.error("Failed to load trading accounts:", err);
      setAccounts([]);
      setDefaultAccount(null);
    }
  }, []);

  const loadCloudProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userProf = await fetchUserProfile(user.id);
        setProfile(userProf);

        const userPrefs = await fetchUserPreferences(user.id);
        if (userPrefs) {
          setPreferences(userPrefs);
          const store = useJournalStore.getState();
          if (userPrefs.default_chart_theme === "dark" || userPrefs.default_chart_theme === "light") {
            store.setTheme(userPrefs.default_chart_theme as any);
          }
          if (userPrefs.default_trade_currency) {
            store.setDisplayCurrency(userPrefs.default_trade_currency as any);
          }
        }

        await loadAccounts(user.id);
      }
    } catch (err) {
      console.error("UserProfileProvider load failed:", err);
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
      console.error("saveProfileUpdates error:", error);
      return false;
    }
    if (data) {
      setProfile(data);
      return true;
    }
    return false;
  };

  const savePreferenceUpdates = async (updates: Partial<UserPreferences>): Promise<boolean> => {
    if (!profile) return false;
    const { data } = await updateUserPreferences(profile.id, updates);
    if (data) {
      setPreferences(data);
    }
    const store = useJournalStore.getState();
    if (updates.default_chart_theme) store.setTheme(updates.default_chart_theme as any);
    if (updates.default_trade_currency) store.setDisplayCurrency(updates.default_trade_currency as any);
    return true;
  };

  const switchDefaultAccount = async (accountId: string): Promise<boolean> => {
    if (!profile) return false;
    const { data } = await updateTradingAccount(accountId, profile.id, { is_default: true });
    if (data) {
      await loadAccounts(profile.id);
      return true;
    }
    return false;
  };

  const addNewAccount = async (payload: NewTradingAccount): Promise<TradingAccount | null> => {
    if (!profile) return null;
    const { data } = await createTradingAccount(profile.id, payload);
    if (data) {
      await loadAccounts(profile.id);
      return data;
    }
    return null;
  };

  const completionPct = calculateProfileCompletion(profile);

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
        refreshAccounts: async () => { if (profile) await loadAccounts(profile.id); },
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
