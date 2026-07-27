"use client";
// context/UserProfileContext.tsx
// Single source of truth React Context for user profile and preferences.
// Synchronizes avatar, full_name, username, country, timezone, currency, and settings globally across all components.

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
import { useJournalStore } from "@/lib/store/useJournalStore";

interface UserProfileContextType {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  loading: boolean;
  completionPct: number;
  refreshProfile: () => Promise<void>;
  saveProfileUpdates: (updates: Partial<UserProfile>) => Promise<boolean>;
  savePreferenceUpdates: (updates: Partial<UserPreferences>) => Promise<boolean>;
}

const UserProfileContext = createContext<UserProfileContextType>({
  profile: null,
  preferences: null,
  loading: true,
  completionPct: 20,
  refreshProfile: async () => {},
  saveProfileUpdates: async () => false,
  savePreferenceUpdates: async () => false,
});

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadCloudProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userProf = await fetchUserProfile(user.id);
        const initialProf: UserProfile = userProf || {
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Trader",
          username: user.email?.split("@")[0].toLowerCase() || "trader",
          avatar_url: user.user_metadata?.avatar_url || "",
          bio: "",
          country: "United States",
          timezone: "UTC",
          preferred_currency: "USD",
          preferred_language: "en",
          trading_experience: "Intermediate (1-3 Years)",
        };
        setProfile(initialProf);

        const userPrefs = await fetchUserPreferences(user.id);
        if (userPrefs) {
          setPreferences(userPrefs);
          // Sync UI store theme & currency if loaded
          const store = useJournalStore.getState();
          if (userPrefs.default_chart_theme === "dark" || userPrefs.default_chart_theme === "light" || userPrefs.default_chart_theme === "midnight" || userPrefs.default_chart_theme === "cyberpunk") {
            store.setTheme(userPrefs.default_chart_theme as any);
          }
          if (userPrefs.default_trade_currency) {
            store.setDisplayCurrency(userPrefs.default_trade_currency as any);
          }
        }
      }
    } catch (err) {
      console.error("UserProfileProvider load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCloudProfile();
  }, [loadCloudProfile]);

  const saveProfileUpdates = async (updates: Partial<UserProfile>): Promise<boolean> => {
    if (!profile) return false;
    const { data, error } = await updateUserProfile(profile.id, updates);
    if (data) {
      setProfile(data);
      return true;
    } else if (!error) {
      setProfile({ ...profile, ...updates });
      return true;
    }
    return false;
  };

  const savePreferenceUpdates = async (updates: Partial<UserPreferences>): Promise<boolean> => {
    if (!profile) return false;
    const { data } = await updateUserPreferences(profile.id, updates);
    if (data) {
      setPreferences(data);
    } else {
      setPreferences(prev => prev ? { ...prev, ...updates } : null);
    }

    // Sync theme and currency immediately
    const store = useJournalStore.getState();
    if (updates.default_chart_theme) {
      store.setTheme(updates.default_chart_theme as any);
    }
    if (updates.default_trade_currency) {
      store.setDisplayCurrency(updates.default_trade_currency as any);
    }
    return true;
  };

  const completionPct = calculateProfileCompletion(profile);

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        preferences,
        loading,
        completionPct,
        refreshProfile: loadCloudProfile,
        saveProfileUpdates,
        savePreferenceUpdates,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => useContext(UserProfileContext);
