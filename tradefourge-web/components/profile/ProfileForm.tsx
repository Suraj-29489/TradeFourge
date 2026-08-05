"use client";

import React, { useState, useEffect } from "react";
import { User, Mail, Check, AlertCircle, Save, RotateCcw, Sparkles, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchUserProfile,
  updateUserProfile,
  checkUsernameAvailable,
  type UserProfile,
} from "@/lib/supabase/profile";
import { useUserProfile } from "@/context/UserProfileContext";

export function ProfileForm() {
  const { refreshProfile } = useUserProfile();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Fields (Essential Only)
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  // Validation & Notice State
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || "");
          const userProf = await fetchUserProfile(user.id);
          const initialProf: UserProfile = userProf || {
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Trader",
            username: user.email?.split("@")[0].toLowerCase() || "trader",
            bio: "",
          };

          setProfile(initialProf);
          setFullName(initialProf.full_name || "");
          setUsername(initialProf.username || "");
          setBio(initialProf.bio || "");
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Track Unsaved Changes
  useEffect(() => {
    if (!profile) return;
    const changed =
      fullName !== (profile.full_name || "") ||
      username !== (profile.username || "") ||
      bio !== (profile.bio || "");

    setHasChanges(changed);
  }, [fullName, username, bio, profile]);

  // Username Availability Debounce Check
  useEffect(() => {
    if (!profile || !username || username === profile.username) {
      setUsernameAvailable(true);
      setUsernameChecking(false);
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameChecking(true);
      const isFree = await checkUsernameAvailable(username, profile.id);
      setUsernameAvailable(isFree);
      setUsernameChecking(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [username, profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (usernameAvailable === false) {
      setErrorToast("Username is already taken. Please choose another.");
      return;
    }

    setErrorToast(null);
    setSuccessToast(null);
    setSaving(true);

    const updates: Partial<UserProfile> = {
      full_name: fullName.trim(),
      username: username.trim().toLowerCase(),
      bio: bio.trim(),
    };

    const { data, error } = await updateUserProfile(profile.id, updates);

    setSaving(false);
    if (error) {
      setErrorToast(error);
    } else {
      const updatedProf = data || { ...profile, ...updates };
      setProfile(updatedProf);
      setHasChanges(false);
      await refreshProfile();
      setSuccessToast("Profile settings saved successfully!");
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

  const handleReset = () => {
    if (!profile) return;
    setFullName(profile.full_name || "");
    setUsername(profile.username || "");
    setBio(profile.bio || "");
    setHasChanges(false);
    setErrorToast(null);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl mx-auto pb-12 font-mono">
      {/* Toast Notifications */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2 shadow-glow animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2 shadow-glow animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Essential Personal Information Card */}
      <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-purple-400" /> Personal Information
          </h3>
          <span className="text-[10px] text-gray-400">Account Identity</span>
        </div>

        {/* Full Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-300 block">Full Name</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Alex Mercer"
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-300 block">Username</label>
            {usernameChecking ? (
              <span className="text-[10px] text-purple-400">Checking availability...</span>
            ) : usernameAvailable === true ? (
              <span className="text-[10px] text-emerald-400 font-bold">Available</span>
            ) : usernameAvailable === false ? (
              <span className="text-[10px] text-rose-400 font-bold">Taken</span>
            ) : null}
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500 text-xs">@</span>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder="username"
              className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>

        {/* Email (Read-only) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-300 block">Email Address (Read-only)</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
            <input
              type="email"
              disabled
              value={userEmail}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-gray-400 text-xs cursor-not-allowed select-all"
            />
          </div>
        </div>

        {/* Bio (Optional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-300 block">Bio (Optional)</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short trading summary or objective..."
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs font-sans focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Save Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving || !hasChanges || usernameAvailable === false}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-glow transition-all flex items-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Profile</span>
          </button>
        </div>
      </div>

      {/* Floating unsaved indicator if scrolling */}
      {hasChanges && (
        <div className="sticky bottom-4 z-20 p-4 rounded-2xl bg-[#111726]/95 border border-purple-500/40 backdrop-blur-md shadow-2xl flex items-center justify-between animate-slide-up">
          <div className="flex items-center gap-2 text-xs text-purple-300">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Unsaved profile changes</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>

            <button
              type="submit"
              disabled={saving || usernameAvailable === false}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-glow transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
