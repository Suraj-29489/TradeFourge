// lib/supabase/profile.ts
// Bulletproof User Profile & Preferences service with dual Supabase + localStorage persistence.
// Ensures zero raw schema errors, persistent avatars, and seamless reload across refresh/restart.

import { createClient } from "./client";

export interface UserProfile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  bio: string;
  country: string;
  timezone: string;
  preferred_currency: string;
  preferred_language: string;
  trading_experience: string;
  trading_style?: string;
  risk_preference?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserPreferences {
  id?: string;
  user_id: string;
  dashboard_layout: string;
  default_account: string;
  default_chart_theme: string;
  notifications_enabled: boolean;
  email_notifications: boolean;
  marketing_emails: boolean;
  default_trade_currency: string;
  date_format: string;
  time_format: string;
  week_start: string;
  risk_display_mode: string;
  analytics_defaults?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface UserStatistics {
  id?: string;
  user_id: string;
  total_trades: number;
  total_profit: number;
  total_loss: number;
  win_rate: number;
  average_rr: number;
  current_streak: number;
  best_day: number;
  worst_day: number;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_PROFILE = (userId: string): UserProfile => ({
  id: userId,
  full_name: "Trader",
  username: `trader_${userId.slice(0, 4)}`,
  avatar_url: "",
  bio: "",
  country: "United States",
  timezone: "UTC",
  preferred_currency: "USD",
  preferred_language: "en",
  trading_experience: "Intermediate (1-3 Years)",
  trading_style: "Day Trader",
  risk_preference: "Moderate (1-2% / trade)",
});

export const DEFAULT_PREFERENCES = (userId: string): UserPreferences => ({
  user_id: userId,
  dashboard_layout: "standard",
  default_account: "main",
  default_chart_theme: "dark",
  notifications_enabled: true,
  email_notifications: true,
  marketing_emails: false,
  default_trade_currency: "USD",
  date_format: "YYYY-MM-DD",
  time_format: "24h",
  week_start: "Monday",
  risk_display_mode: "percentage",
});

/* ─── LocalStorage Cache Helpers ─────────────────────────────────────────── */

function getLocalProfile(userId: string): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`tf_profile_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalProfile(userId: string, profile: UserProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`tf_profile_${userId}`, JSON.stringify(profile));
  } catch {}
}

function getLocalPreferences(userId: string): UserPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`tf_preferences_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalPreferences(userId: string, prefs: UserPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`tf_preferences_${userId}`, JSON.stringify(prefs));
  } catch {}
}

/* ─── Profile Services ────────────────────────────────────────────────────── */

/**
 * Fetch complete profile data for a given user ID.
 * Supabase Cloud is the single authoritative source of truth.
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!error && data) {
      const cloudProfile: UserProfile = {
        ...DEFAULT_PROFILE(userId),
        ...data,
      };
      setLocalProfile(userId, cloudProfile);
      return cloudProfile;
    }

    // If profile row does not exist in Supabase, try generating from Auth Metadata
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id === userId) {
      const authProfile: UserProfile = {
        ...DEFAULT_PROFILE(userId),
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Trader",
        username: (user.user_metadata?.username || user.email?.split("@")[0] || `trader_${userId.slice(0, 4)}`).toLowerCase(),
        avatar_url: user.user_metadata?.avatar_url || "",
      };
      // Upsert authentic profile into Supabase
      await supabase.from("profiles").upsert(authProfile, { onConflict: "id" });
      setLocalProfile(userId, authProfile);
      return authProfile;
    }
  } catch (err) {
    console.error("fetchUserProfile cloud query failed:", err);
  }

  // Fallback only if offline / error
  const cached = getLocalProfile(userId);
  const fallback = cached || DEFAULT_PROFILE(userId);
  return fallback;
}

/**
 * Update user profile details in Supabase Cloud and localStorage.
 * Includes explicit field sanitization, robust error logging, and immediate post-save verification.
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ data: UserProfile; error: string | null }> {
  if (!userId) {
    return { data: DEFAULT_PROFILE(""), error: "User ID is required." };
  }

  const supabase = createClient();

  // Sanitize fields to match database schema exactly
  const payload: Record<string, any> = {
    id: userId,
    updated_at: new Date().toISOString(),
  };

  if (updates.full_name !== undefined) payload.full_name = updates.full_name.trim();
  if (updates.username !== undefined) payload.username = updates.username.trim().toLowerCase();
  if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url;
  if (updates.bio !== undefined) payload.bio = updates.bio.trim();
  if (updates.country !== undefined) payload.country = updates.country;
  if (updates.timezone !== undefined) payload.timezone = updates.timezone;
  if (updates.preferred_currency !== undefined) payload.preferred_currency = updates.preferred_currency;
  if (updates.preferred_language !== undefined) payload.preferred_language = updates.preferred_language;
  if (updates.trading_experience !== undefined) payload.trading_experience = updates.trading_experience;
  if (updates.trading_style !== undefined) payload.trading_style = updates.trading_style;
  if (updates.risk_preference !== undefined) payload.risk_preference = updates.risk_preference;

  console.log("Saving user profile payload to Supabase:", payload);

  let supabaseError: string | null = null;
  let savedData: any = null;

  try {
    // 1. Try Upsert first
    const { data: upsertData, error: upsertErr } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (!upsertErr && upsertData) {
      savedData = upsertData;
    } else {
      if (upsertErr) {
        console.warn("Supabase upsert profile warning, trying update fallback:", upsertErr.message);
      }
      // 2. Fallback to direct UPDATE if upsert was blocked or encountered constraint
      const { data: updateData, error: updateErr } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", userId)
        .select()
        .single();

      if (!updateErr && updateData) {
        savedData = updateData;
      } else if (updateErr) {
        supabaseError = updateErr.message || "Failed to update profile in database.";
        console.error("Supabase update profile error:", updateErr);
      }
    }
  } catch (err: any) {
    console.error("updateUserProfile unexpected error:", err);
    supabaseError = err?.message || "An unexpected error occurred during save.";
  }

  if (supabaseError && !savedData) {
    // Return error transparently so UI & Context know save failed!
    const cached = getLocalProfile(userId) || DEFAULT_PROFILE(userId);
    return { data: cached, error: supabaseError };
  }

  // 3. Post-save Database Verification Query
  try {
    const { data: verifiedData, error: verifyErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!verifyErr && verifiedData) {
      console.log("Post-save database verification SUCCESS:", verifiedData);
      const cloudProfile: UserProfile = {
        ...DEFAULT_PROFILE(userId),
        ...verifiedData,
      };
      setLocalProfile(userId, cloudProfile);
      return { data: cloudProfile, error: null };
    }
  } catch (verifyErr) {
    console.warn("Post-save verification query warning:", verifyErr);
  }

  // Fallback if verification query was interrupted but write succeeded
  const finalProfile: UserProfile = {
    ...DEFAULT_PROFILE(userId),
    ...(savedData || payload),
  };
  setLocalProfile(userId, finalProfile);
  return { data: finalProfile, error: null };
}

/**
 * Check if a username is unique across all profiles
 */
export async function checkUsernameAvailable(
  username: string,
  currentUserId: string
): Promise<boolean> {
  const clean = username.trim().toLowerCase();
  if (!clean) return false;

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", clean)
      .neq("id", currentUserId);

    if (error) return true;
    return !data || data.length === 0;
  } catch {
    return true;
  }
}



/* ─── Preferences Services ────────────────────────────────────────────────── */

/**
 * Fetch user preferences with dual Supabase + localStorage persistence.
 * Uses maybeSingle() to avoid PGRST116 errors on missing rows.
 */
export async function fetchUserPreferences(userId: string): Promise<UserPreferences> {
  if (!userId) return DEFAULT_PREFERENCES("");
  const supabase = createClient();
  const cached = getLocalPreferences(userId);

  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      const cloudPrefs = { ...DEFAULT_PREFERENCES(userId), ...data };
      setLocalPreferences(userId, cloudPrefs);
      return cloudPrefs;
    }

    // If no row exists yet in Supabase, create the initial default row
    if (!error && !data) {
      const defaultPayload = {
        ...DEFAULT_PREFERENCES(userId),
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: createdData } = await supabase
        .from("user_preferences")
        .insert(defaultPayload)
        .select()
        .maybeSingle();

      if (createdData) {
        const cloudPrefs = { ...DEFAULT_PREFERENCES(userId), ...createdData };
        setLocalPreferences(userId, cloudPrefs);
        return cloudPrefs;
      }
    }
  } catch (err) {
    console.error("fetchUserPreferences cloud error:", err);
  }

  const fallback = cached || DEFAULT_PREFERENCES(userId);
  return fallback;
}

/**
 * Update user preferences in Supabase Cloud and localStorage.
 * Uses a bulletproof multi-stage write pipeline (UPDATE → UPSERT → INSERT) with real error reporting.
 */
export async function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferences>
): Promise<{ data: UserPreferences; error: string | null }> {
  if (!userId) {
    return { data: DEFAULT_PREFERENCES(""), error: "User ID is required." };
  }

  const supabase = createClient();

  const payload: Record<string, any> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  if (updates.dashboard_layout !== undefined) payload.dashboard_layout = updates.dashboard_layout;
  if (updates.default_account !== undefined) payload.default_account = updates.default_account;
  if (updates.default_chart_theme !== undefined) payload.default_chart_theme = updates.default_chart_theme;
  if (updates.notifications_enabled !== undefined) payload.notifications_enabled = updates.notifications_enabled;
  if (updates.email_notifications !== undefined) payload.email_notifications = updates.email_notifications;
  if (updates.marketing_emails !== undefined) payload.marketing_emails = updates.marketing_emails;
  if (updates.default_trade_currency !== undefined) payload.default_trade_currency = updates.default_trade_currency;
  if (updates.date_format !== undefined) payload.date_format = updates.date_format;
  if (updates.time_format !== undefined) payload.time_format = updates.time_format;
  if (updates.week_start !== undefined) payload.week_start = updates.week_start;
  if (updates.risk_display_mode !== undefined) payload.risk_display_mode = updates.risk_display_mode;
  if (updates.analytics_defaults !== undefined) payload.analytics_defaults = updates.analytics_defaults;

  console.log("Saving user preferences payload to Supabase:", payload);

  let supabaseError: string | null = null;
  let savedData: any = null;

  // Stage 1: Try direct UPDATE on existing user_preferences row
  try {
    const { data: updateData, error: updateErr } = await supabase
      .from("user_preferences")
      .update(payload)
      .eq("user_id", userId)
      .select()
      .maybeSingle();

    if (!updateErr && updateData) {
      savedData = updateData;
    } else {
      // Stage 2: If no existing row (or update returned null), perform UPSERT
      const { data: upsertData, error: upsertErr } = await supabase
        .from("user_preferences")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .maybeSingle();

      if (!upsertErr && upsertData) {
        savedData = upsertData;
      } else {
        // Stage 3: Direct INSERT fallback
        const { data: insertData, error: insertErr } = await supabase
          .from("user_preferences")
          .insert(payload)
          .select()
          .maybeSingle();

        if (!insertErr && insertData) {
          savedData = insertData;
        } else {
          supabaseError = (insertErr || upsertErr || updateErr)?.message || "Failed to persist preferences to cloud database.";
          console.error("Supabase preferences write error:", insertErr || upsertErr || updateErr);
        }
      }
    }
  } catch (err: any) {
    console.error("updateUserPreferences unexpected error:", err);
    supabaseError = err?.message || "An unexpected error occurred during preferences save.";
  }

  // Sync default trade currency to profiles table if updated
  if (payload.default_trade_currency) {
    try {
      await supabase.from("profiles").update({ preferred_currency: payload.default_trade_currency }).eq("id", userId);
    } catch {}
  }

  if (savedData) {
    const finalPrefs: UserPreferences = {
      ...DEFAULT_PREFERENCES(userId),
      ...savedData,
    };
    setLocalPreferences(userId, finalPrefs);
    return { data: finalPrefs, error: null };
  }

  // Return real error message if write failed
  const cached = getLocalPreferences(userId) || DEFAULT_PREFERENCES(userId);
  return { data: cached, error: supabaseError || "Unable to save preferences to cloud database." };
}

/**
 * Fetch user statistics
 */
export async function fetchUserStatistics(userId: string): Promise<UserStatistics | null> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("user_statistics")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching user statistics:", error);
    }
    return data || null;
  } catch {
    return null;
  }
}

/**
 * Calculate profile completion percentage (0 - 100%)
 */
export function calculateProfileCompletion(profile: UserProfile | null): number {
  if (!profile) return 33;
  let score = 33;
  if (profile.full_name && profile.full_name.trim().length > 0 && profile.full_name !== "Trader") score += 33;
  if (profile.username && profile.username.trim().length > 0) score += 34;
  return Math.min(100, score);
}
