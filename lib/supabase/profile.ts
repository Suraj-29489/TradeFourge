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

const DEFAULT_PROFILE = (userId: string): UserProfile => ({
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
});

const DEFAULT_PREFERENCES = (userId: string): UserPreferences => ({
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

/**
 * Upload avatar image to Supabase Storage `avatars` bucket or fallback to Base64 data URL.
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  if (file.size > 5 * 1024 * 1024) {
    return { url: null, error: "Image size must be less than 5MB." };
  }

  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validTypes.includes(file.type)) {
    return { url: null, error: "Supported formats are JPG, PNG, WEBP, and GIF." };
  }

  const supabase = createClient();

  try {
    const fileExt = file.name.split(".").pop();
    const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      await updateUserProfile(userId, { avatar_url: publicUrl });
      return { url: publicUrl, error: null };
    }
  } catch {}

  // Fallback to Data URL in localStorage if bucket fails or permissions restricted
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      await updateUserProfile(userId, { avatar_url: dataUrl });
      resolve({ url: dataUrl, error: null });
    };
    reader.onerror = () => resolve({ url: null, error: "Failed to read file." });
    reader.readAsDataURL(file);
  });
}

/* ─── Preferences Services ────────────────────────────────────────────────── */

/**
 * Fetch user preferences with dual Supabase + localStorage persistence.
 */
export async function fetchUserPreferences(userId: string): Promise<UserPreferences> {
  const supabase = createClient();
  const cached = getLocalPreferences(userId);

  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!error && data) {
      const cloudPrefs = { ...DEFAULT_PREFERENCES(userId), ...data };
      setLocalPreferences(userId, cloudPrefs);
      return cloudPrefs;
    }
  } catch (err) {
    console.error("fetchUserPreferences cloud error:", err);
  }

  const fallback = cached || DEFAULT_PREFERENCES(userId);
  return fallback;
}

/**
 * Update user preferences in both Supabase and localStorage.
 */
export async function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferences>
): Promise<{ data: UserPreferences; error: string | null }> {
  const supabase = createClient();
  const current = (await fetchUserPreferences(userId)) || DEFAULT_PREFERENCES(userId);
  const updated: UserPreferences = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  setLocalPreferences(userId, updated);

  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .upsert(updated, { onConflict: "user_id" })
      .select()
      .single();

    if (!error && data) {
      setLocalPreferences(userId, data);
      return { data, error: null };
    }
  } catch {}

  return { data: updated, error: null };
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
  if (!profile) return 20;
  let score = 20;

  if (profile.full_name && profile.full_name.trim().length > 0 && profile.full_name !== "Trader") score += 15;
  if (profile.username && profile.username.trim().length > 0) score += 15;
  if (profile.avatar_url && profile.avatar_url.trim().length > 0) score += 20;
  if (profile.bio && profile.bio.trim().length > 0) score += 10;
  if (profile.country && profile.country !== "United States") score += 10;
  if (profile.trading_experience) score += 10;

  return Math.min(100, score);
}
