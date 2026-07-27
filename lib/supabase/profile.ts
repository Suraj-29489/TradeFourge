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

/**
 * Fetch complete profile data for a given user ID
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching user profile:", error);
    }
    return data || null;
  } catch (err) {
    console.error("Failed to fetch profile:", err);
    return null;
  }
}

/**
 * Update user profile details
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ data: UserProfile | null; error: string | null }> {
  const supabase = createClient();
  try {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...payload }, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to update profile." };
  }
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
 * Upload avatar image to Supabase Storage `avatars` bucket.
 * Automatically deletes any previously existing avatar for the user.
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient();

  // Validate size <= 5MB
  if (file.size > 5 * 1024 * 1024) {
    return { url: null, error: "Image size must be less than 5MB." };
  }

  // Validate format
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    return { url: null, error: "Supported formats are JPG, PNG, and WEBP." };
  }

  try {
    const fileExt = file.name.split(".").pop();
    const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`;

    // Upload to avatars bucket
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      return { url: null, error: uploadError.message };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // Update profile table
    await updateUserProfile(userId, { avatar_url: publicUrl });

    return { url: publicUrl, error: null };
  } catch (err: any) {
    return { url: null, error: err?.message || "Failed to upload avatar." };
  }
}

/**
 * Fetch user preferences
 */
export async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching user preferences:", error);
    }
    return data || null;
  } catch {
    return null;
  }
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferences>
): Promise<{ data: UserPreferences | null; error: string | null }> {
  const supabase = createClient();
  try {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: userId, ...payload }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to update preferences." };
  }
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
  let score = 20; // Default score for account creation

  if (profile.full_name && profile.full_name.trim().length > 0) score += 15;
  if (profile.username && profile.username.trim().length > 0) score += 15;
  if (profile.avatar_url && profile.avatar_url.trim().length > 0) score += 20;
  if (profile.bio && profile.bio.trim().length > 0) score += 10;
  if (profile.country && profile.country !== "United States") score += 10;
  if (profile.trading_experience) score += 10;

  return Math.min(100, score);
}
