"use client";

import React, { useState, useEffect } from "react";
import { User, Mail, Globe, Clock, DollarSign, Camera, Check, AlertCircle, Save, RotateCcw, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchUserProfile,
  updateUserProfile,
  checkUsernameAvailable,
  uploadAvatar,
  calculateProfileCompletion,
  type UserProfile,
} from "@/lib/supabase/profile";

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Singapore",
  "Japan",
  "India",
  "Brazil",
  "United Arab Emirates",
  "Switzerland",
  "Netherlands",
];

const TIMEZONES = [
  "UTC",
  "America/New_York (EST/EDT)",
  "America/Chicago (CST/CDT)",
  "America/Denver (MST/MDT)",
  "America/Los_Angeles (PST/PDT)",
  "Europe/London (GMT/BST)",
  "Europe/Frankfurt (CET/CEST)",
  "Asia/Dubai (GST)",
  "Asia/Singapore (SGT)",
  "Asia/Tokyo (JST)",
  "Asia/Kolkata (IST)",
  "Australia/Sydney (AEST/AEDT)",
];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "CHF", "AED"];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish (Español)" },
  { code: "de", name: "German (Deutsch)" },
  { code: "fr", name: "French (Français)" },
  { code: "ja", name: "Japanese (日本語)" },
];

const EXPERIENCES = ["Beginner (< 1 Year)", "Intermediate (1-3 Years)", "Advanced (3-5 Years)", "Institutional / Professional (5+ Years)"];

export const ProfileForm: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("United States");
  const [timezone, setTimezone] = useState("UTC");
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [tradingExperience, setTradingExperience] = useState("Intermediate (1-3 Years)");

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
            avatar_url: user.user_metadata?.avatar_url || "",
            bio: "",
            country: "United States",
            timezone: "UTC",
            preferred_currency: "USD",
            preferred_language: "en",
            trading_experience: "Intermediate (1-3 Years)",
          };

          setProfile(initialProf);
          setFullName(initialProf.full_name || "");
          setUsername(initialProf.username || "");
          setBio(initialProf.bio || "");
          setCountry(initialProf.country || "United States");
          setTimezone(initialProf.timezone || "UTC");
          setPreferredCurrency(initialProf.preferred_currency || "USD");
          setPreferredLanguage(initialProf.preferred_language || "en");
          setTradingExperience(initialProf.trading_experience || "Intermediate (1-3 Years)");
        }
      } catch (err) {
        console.error(err);
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
      bio !== (profile.bio || "") ||
      country !== (profile.country || "United States") ||
      timezone !== (profile.timezone || "UTC") ||
      preferredCurrency !== (profile.preferred_currency || "USD") ||
      preferredLanguage !== (profile.preferred_language || "en") ||
      tradingExperience !== (profile.trading_experience || "Intermediate (1-3 Years)");

    setHasChanges(changed);
  }, [fullName, username, bio, country, timezone, preferredCurrency, preferredLanguage, tradingExperience, profile]);

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setErrorToast(null);
    setSuccessToast(null);
    setUploadingAvatar(true);

    const { url, error } = await uploadAvatar(profile.id, file);

    setUploadingAvatar(false);
    if (error) {
      setErrorToast(error);
    } else if (url) {
      setProfile({ ...profile, avatar_url: url });
      setSuccessToast("Profile photo updated successfully!");
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

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
      country,
      timezone,
      preferred_currency: preferredCurrency,
      preferred_language: preferredLanguage,
      trading_experience: tradingExperience,
    };

    const { data, error } = await updateUserProfile(profile.id, updates);

    setSaving(false);
    if (error) {
      setErrorToast(error);
    } else if (data) {
      setProfile(data);
      setHasChanges(false);
      setSuccessToast("Profile settings saved successfully!");
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

  const handleReset = () => {
    if (!profile) return;
    setFullName(profile.full_name || "");
    setUsername(profile.username || "");
    setBio(profile.bio || "");
    setCountry(profile.country || "United States");
    setTimezone(profile.timezone || "UTC");
    setPreferredCurrency(profile.preferred_currency || "USD");
    setPreferredLanguage(profile.preferred_language || "en");
    setTradingExperience(profile.trading_experience || "Intermediate (1-3 Years)");
    setHasChanges(false);
    setErrorToast(null);
  };

  const completionPct = calculateProfileCompletion(profile);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
        <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Toast Notifications */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between shadow-glow animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successToast}</span>
          </div>
        </div>
      )}

      {errorToast && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2 shadow-glow animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Header Profile Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#111726] to-[#182238] border border-white/10 p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          {/* Avatar Container */}
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 p-1 shadow-glow overflow-hidden flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={fullName}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-[#111726] flex items-center justify-center text-3xl font-bold font-mono text-purple-400">
                  {fullName ? fullName.charAt(0).toUpperCase() : "T"}
                </div>
              )}
            </div>

            {/* Upload File Overlay Button */}
            <label className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center gap-1 text-white text-xs font-mono cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-purple-300" />
              <span>Change</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>

            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center text-purple-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
          </div>

          {/* Profile Identity Details */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
                  {fullName || "TradeFourge Trader"}
                </h2>
                <div className="text-xs font-mono text-purple-400 flex items-center justify-center sm:justify-start gap-1">
                  @{username || "username"}
                </div>
              </div>

              {/* Profile Completion Widget */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-right shrink-0">
                <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                  Profile Completion
                </div>
                <div className="flex items-center gap-2 font-mono text-sm font-bold text-emerald-400 justify-end">
                  <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                  <span>{completionPct}%</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-300 max-w-xl leading-relaxed font-sans">
              {bio || "No bio added yet. Add a short summary of your trading strategy or goals."}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2 text-[11px] font-mono text-gray-400">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-purple-400" /> {userEmail}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-indigo-400" /> {country}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> {timezone}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Settings Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Identification Section */}
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4">
          <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <User className="w-4 h-4 text-purple-400" /> Personal Identity
          </h3>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-gray-300 block">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-medium text-gray-300 block">Username</label>
              {usernameChecking ? (
                <span className="text-[10px] font-mono text-purple-400">Checking availability...</span>
              ) : usernameAvailable === true ? (
                <span className="text-[10px] font-mono text-emerald-400 font-bold">Available</span>
              ) : usernameAvailable === false ? (
                <span className="text-[10px] font-mono text-rose-400 font-bold">Taken</span>
              ) : null}
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500 font-mono text-xs">@</span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-gray-300 block">Bio & Trading Objective</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Systematic FX & Index Futures trader focusing on London Session liquidity sweeps."
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs font-sans focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Localization & Preferences Section */}
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4">
          <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <Globe className="w-4 h-4 text-indigo-400" /> Localization & Strategy
          </h3>

          {/* Country */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-gray-300 block">Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-gray-300 block">Primary Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* Currency & Language Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-gray-300 block">Preferred Currency</label>
              <select
                value={preferredCurrency}
                onChange={(e) => setPreferredCurrency(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
              >
                {CURRENCIES.map((cur) => (
                  <option key={cur} value={cur}>{cur}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-gray-300 block">Language</label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Trading Experience */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-gray-300 block">Trading Experience Level</label>
            <select
              value={tradingExperience}
              onChange={(e) => setTradingExperience(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
            >
              {EXPERIENCES.map((exp) => (
                <option key={exp} value={exp}>{exp}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sticky Save / Unsaved Changes Floating Bar */}
      {hasChanges && (
        <div className="sticky bottom-4 z-20 p-4 rounded-2xl bg-[#111726]/95 border border-purple-500/40 backdrop-blur-md shadow-2xl flex items-center justify-between animate-slide-up">
          <div className="flex items-center gap-2 text-xs font-mono text-purple-300">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>You have unsaved profile changes.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-mono text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>

            <button
              type="submit"
              disabled={saving || usernameAvailable === false}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-bold shadow-glow transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
};
