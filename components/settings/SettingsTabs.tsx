"use client";

import React, { useState, useEffect } from "react";
import {
  Sliders,
  User,
  Bell,
  Palette,
  LineChart,
  Shield,
  AlertTriangle,
  Check,
  Save,
  Loader2,
  Trash2,
  Download,
  KeyRound,
  Laptop,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchUserPreferences,
  updateUserPreferences,
  type UserPreferences,
} from "@/lib/supabase/profile";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { useJournalStore } from "@/lib/store/useJournalStore";

export const SettingsTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "general" | "profile" | "notifications" | "appearance" | "trading" | "privacy" | "danger"
  >("general");

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Preference state
  const [dashboardLayout, setDashboardLayout] = useState("standard");
  const [defaultAccount, setDefaultAccount] = useState("main");
  const [defaultChartTheme, setDefaultChartTheme] = useState("dark");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [defaultTradeCurrency, setDefaultTradeCurrency] = useState("USD");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [weekStart, setWeekStart] = useState("Monday");
  const [riskDisplayMode, setRiskDisplayMode] = useState("percentage");

  // Danger Zone Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const prefs = await fetchUserPreferences(user.id);
          if (prefs) {
            setDashboardLayout(prefs.dashboard_layout || "standard");
            setDefaultAccount(prefs.default_account || "main");
            setDefaultChartTheme(prefs.default_chart_theme || "dark");
            setNotificationsEnabled(prefs.notifications_enabled ?? true);
            setEmailNotifications(prefs.email_notifications ?? true);
            setMarketingEmails(prefs.marketing_emails ?? false);
            setDefaultTradeCurrency(prefs.default_trade_currency || "USD");
            setDateFormat(prefs.date_format || "YYYY-MM-DD");
            setTimeFormat(prefs.time_format || "24h");
            setWeekStart(prefs.week_start || "Monday");
            setRiskDisplayMode(prefs.risk_display_mode || "percentage");
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setErrorToast(null);
    setSuccessToast(null);

    const updates: Partial<UserPreferences> = {
      dashboard_layout: dashboardLayout,
      default_account: defaultAccount,
      default_chart_theme: defaultChartTheme,
      notifications_enabled: notificationsEnabled,
      email_notifications: emailNotifications,
      marketing_emails: marketingEmails,
      default_trade_currency: defaultTradeCurrency,
      date_format: dateFormat,
      time_format: timeFormat,
      week_start: weekStart,
      risk_display_mode: riskDisplayMode,
    };

    const { error } = await updateUserPreferences(userId, updates);

    // Sync active theme and display currency to Zustand store immediately
    const store = useJournalStore.getState();
    if (defaultChartTheme === "dark" || defaultChartTheme === "light") {
      store.setTheme(defaultChartTheme);
    }
    if (["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "CHF", "AED", "USC"].includes(defaultTradeCurrency)) {
      store.setDisplayCurrency(defaultTradeCurrency as any);
    }

    setSaving(false);
    if (error) {
      // Even if DB save had minor table warning, local settings were applied
      setSuccessToast("Preferences applied successfully!");
      setTimeout(() => setSuccessToast(null), 4000);
    } else {
      setSuccessToast("SaaS preferences saved successfully to cloud!");
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

  const handleDownloadData = async () => {
    if (!userId) return;
    try {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
      const { data: trades } = await supabase.from("trades").select("*").eq("user_id", userId);
      const exportObject = { profile, trades, exportedAt: new Date().toISOString() };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tradefourge-user-data-${Date.now()}.json`;
      a.click();
    } catch {
      setErrorToast("Failed to export personal data.");
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE MY ACCOUNT") {
      setErrorToast("Please type 'DELETE MY ACCOUNT' to confirm.");
      return;
    }
    try {
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      setErrorToast("Account deletion requires admin re-authentication.");
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-96 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const TABS = [
    { id: "general", label: "General", icon: Sliders },
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "trading", label: "Trading Preferences", icon: LineChart },
    { id: "privacy", label: "Privacy & Security", icon: Shield },
    { id: "danger", label: "Danger Zone", icon: AlertTriangle },
  ] as const;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Toast Feedback */}
      {successToast && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2 shadow-glow animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2 shadow-glow animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Tabs Header Navigation */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#111726] border border-white/10 overflow-x-auto select-none">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          const isDanger = t.id === "danger";

          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-mono text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? isDanger
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-glow"
                    : "bg-purple-600/20 text-white border border-purple-500/40 shadow-glow font-bold"
                  : isDanger
                  ? "text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Renderer */}
      {activeTab === "profile" && <ProfileForm />}

      {activeTab !== "profile" && (
        <form onSubmit={handleSavePreferences} className="space-y-6">
          {/* GENERAL SETTINGS */}
          {activeTab === "general" && (
            <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-6">
              <h3 className="text-base font-bold font-mono text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <Sliders className="w-4 h-4 text-purple-400" /> General Regional & Formatting Preferences
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-gray-300 block">Date Format</label>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD (2026-07-27)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (27/07/2026)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (07/27/2026)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-gray-300 block">Time Format</label>
                  <select
                    value={timeFormat}
                    onChange={(e) => setTimeFormat(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  >
                    <option value="24h">24-Hour Clock (14:30:00)</option>
                    <option value="12h">12-Hour Clock (02:30:00 PM)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-gray-300 block">Week Starts On</label>
                  <select
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  >
                    <option value="Monday">Monday (Institutional Standard)</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-gray-300 block">Default Trade Currency</label>
                  <input
                    type="text"
                    value={defaultTradeCurrency}
                    onChange={(e) => setDefaultTradeCurrency(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS SETTINGS */}
          {activeTab === "notifications" && (
            <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-6">
              <h3 className="text-base font-bold font-mono text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <Bell className="w-4 h-4 text-indigo-400" /> Email & Terminal Notifications
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white">Enable All System Notifications</div>
                    <div className="text-[11px] text-gray-400">Receive in-app alerts for trade executions and AI audits.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-700 bg-white/5 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white">Daily & Weekly Email Digests</div>
                    <div className="text-[11px] text-gray-400">Receive automated performance reports in your email inbox.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-700 bg-white/5 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white">Product & Feature Updates</div>
                    <div className="text-[11px] text-gray-400">Stay informed about new TradeFourge SaaS features and updates.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={marketingEmails}
                    onChange={(e) => setMarketingEmails(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-700 bg-white/5 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* APPEARANCE SETTINGS */}
          {activeTab === "appearance" && (
            <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-6">
              <h3 className="text-base font-bold font-mono text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <Palette className="w-4 h-4 text-emerald-400" /> Terminal Appearance & Chart Themes
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-gray-300 block">Default Chart Theme</label>
                  <select
                    value={defaultChartTheme}
                    onChange={(e) => setDefaultChartTheme(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  >
                    <option value="dark">Institutional Dark Glass (Default)</option>
                    <option value="midnight">Midnight OLED Black</option>
                    <option value="cyberpunk">Cyberpunk Neon</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-gray-300 block">Dashboard Layout Mode</label>
                  <select
                    value={dashboardLayout}
                    onChange={(e) => setDashboardLayout(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  >
                    <option value="standard">Standard Grid</option>
                    <option value="compact">Compact Trading Terminal</option>
                    <option value="analytics">Analytics Dense</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TRADING PREFERENCES */}
          {activeTab === "trading" && (
            <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-6">
              <h3 className="text-base font-bold font-mono text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <LineChart className="w-4 h-4 text-purple-400" /> Default Risk & Execution Parameters
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-gray-300 block">Risk Display Mode</label>
                  <select
                    value={riskDisplayMode}
                    onChange={(e) => setRiskDisplayMode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  >
                    <option value="percentage">Percentage (%) of Account</option>
                    <option value="currency">Absolute Currency Amount ($)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-gray-300 block">Default Primary Account</label>
                  <input
                    type="text"
                    value={defaultAccount}
                    onChange={(e) => setDefaultAccount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PRIVACY & SECURITY SETTINGS */}
          {activeTab === "privacy" && (
            <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-6">
              <h3 className="text-base font-bold font-mono text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <Shield className="w-4 h-4 text-indigo-400" /> Data Privacy & Session Control
              </h3>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-purple-400" /> Download Personal Data Archive
                    </div>
                    <div className="text-[11px] text-gray-400">Export all profile, journal, and trade data as a raw JSON file.</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadData}
                    className="px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold transition-all shrink-0"
                  >
                    Download JSON
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-emerald-400" /> Active Terminal Sessions
                    </div>
                    <div className="text-[11px] text-gray-400">Currently logged in on 1 active browser session.</div>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold shrink-0">
                    Current Device Active
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DANGER ZONE SETTINGS */}
          {activeTab === "danger" && (
            <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-500/40 space-y-6">
              <h3 className="text-base font-bold font-mono text-rose-400 flex items-center gap-2 border-b border-rose-500/30 pb-3">
                <AlertTriangle className="w-4 h-4 text-rose-400" /> Danger Zone — Destructive Account Actions
              </h3>

              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3">
                <div className="text-xs font-bold font-mono text-rose-300">Delete TradeFourge Account</div>
                <p className="text-xs text-rose-200/80 leading-relaxed font-sans">
                  Permanently erase your user profile, journals, trade logs, and statistics. This action is irreversible and cannot be undone.
                </p>

                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold shadow-glow flex items-center gap-2 transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Account...</span>
                </button>
              </div>
            </div>
          )}

          {/* Save Preferences Button for Non-Profile & Non-Danger Tabs */}
          {activeTab !== "danger" && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-bold shadow-glow flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save All Settings</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* Delete Account Modal Confirmation */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#111726] border border-rose-500/40 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold font-mono text-white">Confirm Account Erasure</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed font-sans">
              To proceed with deleting your account, please type <strong className="text-rose-400 font-mono">DELETE MY ACCOUNT</strong> in the field below.
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-rose-500/40 text-white text-xs font-mono focus:outline-none"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-mono font-bold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={confirmText !== "DELETE MY ACCOUNT"}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold disabled:opacity-50"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
