"use client";
// context/UserProfileContext.tsx
// TradeFourge v3.6.0 Dedicated User Profile & Preferences Context.
// Responsible ONLY for User Profile, Preferences, and Display Settings.

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
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useAccounts } from "@/context/AccountsContext";

import { isOwner as checkIsOwner, UserRole, resolveProfileRole } from "@/lib/config/owner";

interface UserProfileContextType {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  loading: boolean;
  completionPct: number;
  isOwner: boolean;
  role: UserRole;
  refreshProfile: () => Promise<void>;
  saveProfileUpdates: (updates: Partial<UserProfile>) => Promise<boolean>;
  savePreferenceUpdates: (updates: Partial<UserPreferences>) => Promise<{ success: boolean; error: string | null }>;
}

const UserProfileContext = createContext<UserProfileContextType>({
  profile: null,
  preferences: null,
  loading: true,
  completionPct: 20,
  isOwner: false,
  role: "user",
  refreshProfile: async () => {},
  saveProfileUpdates: async () => false,
  savePreferenceUpdates: async () => ({ success: false, error: null }),
});

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const userIdRef = useRef<string | null>(null);
  const supabase = createClient();

  const loadCloudProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        userIdRef.current = null;
        setProfile(null);
        setPreferences(null);
        return;
      }
      userIdRef.current = user.id;

      // 1. Profile Check
      let userProf = await fetchUserProfile(user.id);
      if (!userProf || !userProf.id) {
        const defaultProfData = DEFAULT_PROFILE(user.id);
        const { data: healedProf } = await updateUserProfile(user.id, defaultProfData);
        userProf = healedProf || defaultProfData;
      }
      setProfile(userProf);

      // 2. Preferences Check
      let userPrefs = await fetchUserPreferences(user.id);
      if (!userPrefs) {
        const defaultPrefsData = DEFAULT_PREFERENCES(user.id);
        const { data: healedPrefs } = await updateUserPreferences(user.id, defaultPrefsData);
        userPrefs = healedPrefs || defaultPrefsData;
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
    } catch (err) {
      console.error("[UserProfileProvider] Profile load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    async function initProfile() {
      if (isMounted) await loadCloudProfile();
    }
    initProfile();

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
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const saveProfileUpdates = async (updates: Partial<UserProfile>): Promise<boolean> => {
    const targetUserId = profile?.id || userIdRef.current;
    if (!targetUserId) return false;
    const { data, error } = await updateUserProfile(targetUserId, updates);
    if (error) {
      console.error("[UserProfileProvider] saveProfileUpdates error:", error);
      return false;
    }
    if (data) {
      setProfile(data);
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

    const { data, error } = await updateUserPreferences(targetUserId, updates);
    if (error) {
      console.error("[UserProfileProvider] savePreferenceUpdates error:", error);
      return { success: false, error };
    }
    if (data) {
      setPreferences(data);
    }
    const store = useJournalStore.getState();
    if (updates.default_chart_theme) store.setTheme(updates.default_chart_theme as any);
    if (updates.default_trade_currency) store.setDisplayCurrency(updates.default_trade_currency as any);
    return { success: true, error: null };
  };

  const completionPct = profile ? calculateProfileCompletion(profile) : 20;
  const isOwnerUser = checkIsOwner(profile);
  const effectiveRole = profile?.role || resolveProfileRole({ role: profile?.role });

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        preferences,
        loading,
        completionPct,
        isOwner: isOwnerUser,
        role: effectiveRole,
        refreshProfile: loadCloudProfile,
        saveProfileUpdates,
        savePreferenceUpdates,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};

export const useProfile = () => useContext(UserProfileContext);

// Backwards-compatible Unified Hook combining Profile Context and Accounts Context
export const useUserProfile = () => {
  const profileCtx = useContext(UserProfileContext);
  const accountsCtx = useAccounts();

  return {
    ...profileCtx,
    ...accountsCtx,
  };
};
