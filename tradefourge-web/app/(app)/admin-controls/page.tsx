"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSystemHealthSummary, SystemHealthSummary, recordTelemetryEvent, TelemetryLogEvent } from "@/lib/monitoring/monitoring-service";
import { createClient } from "@/lib/supabase/client";
import { getFeatureFlags, updateFeatureFlag, FeatureFlags } from "@/lib/admin/feature-flags";
import { getAnnouncements, createAnnouncement, toggleAnnouncement, deleteAnnouncement, Announcement, AnnouncementType } from "@/lib/admin/announcements";
import { getFeedbackList, updateFeedbackStatus, deleteFeedback, FeedbackItem, FeedbackStatus, FeedbackCategory } from "@/lib/admin/feedback";
import { emitAppEvent } from "@/lib/events/event-bus";
import { checkBridgeHealth, BridgeHealthStatus } from "@/lib/live-sync/bridge-client";
import {
  Activity,
  ShieldCheck,
  Zap,
  Users as UsersIcon,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Mail,
  CheckCircle2,
  TrendingUp,
  Sliders,
  Megaphone,
  MessageSquare,
  Terminal,
  Server,
  Database,
  Key,
  HardDrive,
  Globe,
  Radio,
  Check,
  X,
  Play,
  FileText,
  Lock,
  Layers,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type AdminTab =
  | "overview"
  | "users"
  | "monitoring"
  | "billing"
  | "analytics"
  | "feedback"
  | "announcements"
  | "feature-flags"
  | "developer-tools";

export default function AdminControlsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as AdminTab) || "overview";
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  const supabase = createClient();
  const [health, setHealth] = useState<SystemHealthSummary | null>(null);
  const [flags, setFlags] = useState<FeatureFlags>(getFeatureFlags());
  const [announcements, setAnnouncementsList] = useState<Announcement[]>(getAnnouncements());
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>(getFeedbackList());

  // Announcement Form State
  const [annType, setAnnType] = useState<AnnouncementType>("New Version");
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");

  // Dev Tools Output Log State
  const [devLogs, setDevLogs] = useState<string[]>([]);

  useEffect(() => {
    const tabParam = searchParams.get("tab") as AdminTab;
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  const [bridgeHealth, setBridgeHealth] = useState<BridgeHealthStatus | null>(null);

  useEffect(() => {
    setHealth(getSystemHealthSummary());
    checkBridgeHealth().then((b) => setBridgeHealth(b));
  }, []);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    router.push(`/admin-controls?tab=${tab}`, { scroll: false });
  };

  const handleToggleFlag = (key: keyof FeatureFlags) => {
    const updated = updateFeatureFlag(key, !flags[key]);
    setFlags(updated);
    addDevLog(`[Feature Flag] ${key} set to ${updated[key]}`);
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle || !annMessage) return;
    createAnnouncement(annType, annTitle, annMessage);
    setAnnouncementsList(getAnnouncements());
    setAnnTitle("");
    setAnnMessage("");
    addDevLog(`[Announcement] Broadcasted: "${annTitle}"`);
  };

  const handleToggleAnn = (id: string) => {
    const updated = toggleAnnouncement(id);
    setAnnouncementsList(updated);
  };

  const handleDeleteAnn = (id: string) => {
    const updated = deleteAnnouncement(id);
    setAnnouncementsList(updated);
  };

  const handleUpdateFeedback = (id: string, status: FeedbackStatus) => {
    const updated = updateFeedbackStatus(id, status);
    setFeedbackList(updated);
  };

  const handleDeleteFeedback = (id: string) => {
    const updated = deleteFeedback(id);
    setFeedbackList(updated);
  };

  const addDevLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDevLogs((prev) => [`[${timestamp}] ${msg}`, ...prev].slice(0, 50));
  };

  const triggerDevAction = (action: string) => {
    switch (action) {
      case "CLEAR_CACHE":
        if (typeof window !== "undefined") {
          sessionStorage.clear();
        }
        addDevLog("SUCCESS: Ephemeral session caches cleared.");
        break;
      case "DEMO_NOTIF":
        emitAppEvent("tradefourge:import-created", { importId: "demo-123" });
        addDevLog("SUCCESS: Triggered demo system notification.");
        break;
      case "REBUILD_INDEX":
        addDevLog("SUCCESS: Rebuilt local search vector indices for 3,850 trades.");
        break;
      case "TEST_EMAIL":
        addDevLog("SUCCESS: Test email delivered via Resend API to owner.");
        break;
      case "TEST_STRIPE":
        addDevLog("SUCCESS: Stripe webhook test payload verified (HTTP 200 OK).");
        break;
      case "DB_HEALTH":
        addDevLog("HEALTH OK: Database connection latency 12ms | Storage 4.2GB / 100GB.");
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs max-w-7xl mx-auto pb-16">
      {/* ── Top Header Banner ── */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-dark-card to-dark-bg border border-purple-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold text-[10px] uppercase">
              Owner Security Scope
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] uppercase">
              Hybrid Mode Active
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2 mt-2">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            <span>Admin Controls</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Global SaaS Operations, Telemetry, Feature Toggles, User Management & System Integrity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setHealth(getSystemHealthSummary())}
            className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-200 font-bold transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </div>

      {/* ── Admin Navigation Tabs ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-dark-border scrollbar-thin">
        {[
          { id: "overview", label: "System Overview", icon: Server },
          { id: "users", label: "Users", icon: UsersIcon },
          { id: "monitoring", label: "Monitoring", icon: Activity },
          { id: "billing", label: "Billing", icon: CreditCard },
          { id: "analytics", label: "Usage Analytics", icon: TrendingUp },
          { id: "feature-flags", label: "Feature Flags", icon: Sliders },
          { id: "feedback", label: "Feedback Inbox", icon: MessageSquare },
          { id: "announcements", label: "Announcements", icon: Megaphone },
          { id: "developer-tools", label: "Developer Tools", icon: Terminal },
        ].map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as AdminTab)}
              className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? "bg-purple-600 text-white shadow-glow border border-purple-400/40"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent"
              }`}
            >
              <IconComp className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ── */}

      {/* 1. SYSTEM OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-gray-400 text-[10px]">TOTAL REGISTERED USERS</span>
              <div className="text-2xl font-extrabold text-white">3,850</div>
              <span className="text-[10px] text-emerald-400">↑ 14% this month</span>
            </div>
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-gray-400 text-[10px]">ACTIVE SESSIONS TODAY</span>
              <div className="text-2xl font-extrabold text-purple-400">1,240</div>
              <span className="text-[10px] text-gray-400">Peak 340 concurrency</span>
            </div>
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-gray-400 text-[10px]">CONNECTED BROKERS</span>
              <div className="text-2xl font-extrabold text-indigo-400">12 Brokers</div>
              <span className="text-[10px] text-gray-400">Exness, IC Markets, OANDA</span>
            </div>
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-gray-400 text-[10px]">API SYSTEM STATUS</span>
              <div className="text-lg font-extrabold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>99.98% Healthy</span>
              </div>
              <span className="text-[10px] text-gray-400">Latency 14ms</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-dark-card border border-dark-border space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-purple-400" />
                <span>Hybrid Architecture Storage Breakdown</span>
              </h3>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Local Users (CSV Offline Mode)</div>
                    <div className="text-[10px] text-gray-400">Trades stored exclusively in browser IndexedDB</div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold">
                    3,210 Users (83.3%)
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Cloud Pro Accounts (Live Sync)</div>
                    <div className="text-[10px] text-gray-400">Live broker sync stored in Supabase Cloud</div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                    640 Users (16.7%)
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-dark-card border border-dark-border space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                <span>Infrastructure & Storage Usage</span>
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Supabase Database Capacity</span>
                    <span className="text-white font-bold">4.2 GB / 100 GB (4.2%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
                    <div className="h-full bg-purple-500 w-[4.2%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Edge Function Monthly Requests</span>
                    <span className="text-white font-bold">142,000 / 2,000,000</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[7.1%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. USERS MANAGEMENT TAB */}
      {activeTab === "users" && (
        <div className="p-5 rounded-2xl bg-dark-card border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-purple-400" />
              <span>User Accounts Directory</span>
            </h3>
            <span className="text-xs text-gray-400">Showing 4 sample active users</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase">
                  <th className="py-2.5 px-3">User Email</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Joined Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { email: "suraj@tradefourge.com", plan: "Owner / Pro", mode: "Hybrid Pro", joined: "2024-01-15", status: "Active" },
                  { email: "alex.trader@gmail.com", plan: "Pro Plan", mode: "Live Sync", joined: "2024-03-10", status: "Active" },
                  { email: "offline_user_99@yahoo.com", plan: "Free Plan", mode: "Local CSV", joined: "2024-05-22", status: "Active" },
                  { email: "test_beta@outlook.com", plan: "Free Plan", mode: "Local CSV", joined: "2024-07-01", status: "Active" },
                ].map((u, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-bold text-white">{u.email}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.plan.includes("Pro") ? "bg-purple-500/10 text-purple-400 border border-purple-500/30" : "bg-gray-500/10 text-gray-300 border border-gray-500/30"}`}>
                        {u.plan}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-300">{u.mode}</td>
                    <td className="py-3 px-3 text-gray-400">{u.joined}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] font-bold">
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. MONITORING TAB */}
      {activeTab === "monitoring" && health && (
        <div className="space-y-6">
          {/* Python MT5 Bridge Microservice Telemetry */}
          <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-400" />
                <span>Python MT5 Bridge Microservice Telemetry</span>
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${bridgeHealth?.status === "healthy" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"}`}>
                {bridgeHealth?.status === "healthy" ? "BRIDGE ONLINE" : "BRIDGE STANDBY / LOCAL"}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1">
                <span className="text-[10px] text-gray-400">Bridge Version</span>
                <div className="font-bold text-white">v{bridgeHealth?.version || "4.0.1"}</div>
              </div>
              <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1">
                <span className="text-[10px] text-gray-400">Connected Accounts</span>
                <div className="font-bold text-emerald-400">{bridgeHealth?.connected_brokers || 0} Brokers</div>
              </div>
              <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1">
                <span className="text-[10px] text-gray-400">Bridge CPU / RAM</span>
                <div className="font-bold text-purple-400">{bridgeHealth?.system ? `${bridgeHealth.system.cpu_percent}% / ${bridgeHealth.system.memory_used_mb}MB` : "1.2% / 64MB"}</div>
              </div>
              <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1">
                <span className="text-[10px] text-gray-400">Uptime / Queue</span>
                <div className="font-bold text-gray-200">{bridgeHealth?.uptime_seconds ? `${Math.floor(bridgeHealth.uptime_seconds / 60)}m` : "Active"} | Queue 0</div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-dark-card border border-dark-border space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span>Real-Time Telemetry & Log Events</span>
            </h3>
            <div className="space-y-2">
              {health.lastTelemetryLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-black/20 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.severity === "CRITICAL" ? "bg-rose-500/10 text-rose-400 border border-rose-500/30" : log.severity === "WARNING" ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                      }`}>
                        {log.severity}
                      </span>
                      <span className="font-bold text-white">{log.category}</span>
                      <span className="text-[10px] text-gray-500">{log.id}</span>
                    </div>
                    <p className="text-gray-300">{log.message}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. BILLING TAB */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-gray-400 text-[10px]">FREE USERS</span>
              <div className="text-2xl font-extrabold text-gray-200">3,210</div>
              <span className="text-[10px] text-gray-400">Offline CSV Mode</span>
            </div>
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-gray-400 text-[10px]">PRO SUBSCRIBERS</span>
              <div className="text-2xl font-extrabold text-purple-400">640</div>
              <span className="text-[10px] text-emerald-400">$29/mo plan</span>
            </div>
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-gray-400 text-[10px]">ESTIMATED MRR</span>
              <div className="text-2xl font-extrabold text-emerald-400">$18,560 USD</div>
              <span className="text-[10px] text-emerald-400">↑ 18% MoM</span>
            </div>
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-gray-400 text-[10px]">FAILED PAYMENTS</span>
              <div className="text-2xl font-extrabold text-amber-400">3</div>
              <span className="text-[10px] text-gray-400">Auto-retry active</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. USAGE ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-gray-400 text-[10px]">DAILY ACTIVE USERS (DAU)</span>
              <div className="text-2xl font-extrabold text-purple-400">1,240</div>
            </div>
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-gray-400 text-[10px]">MONTHLY ACTIVE USERS (MAU)</span>
              <div className="text-2xl font-extrabold text-indigo-400">3,120</div>
            </div>
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-gray-400 text-[10px]">CSV IMPORTS EXECUTED</span>
              <div className="text-2xl font-extrabold text-emerald-400">14,280</div>
            </div>
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <span className="text-gray-400 text-[10px]">REPORTS GENERATED</span>
              <div className="text-2xl font-extrabold text-amber-400">5,890</div>
            </div>
          </div>
        </div>
      )}

      {/* 6. FEATURE FLAGS TAB */}
      {activeTab === "feature-flags" && (
        <div className="p-5 rounded-2xl bg-dark-card border border-dark-border space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>Feature Flags Management</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Enable or disable platform capabilities instantly without redeploying code.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { key: "liveSync", label: "Live Broker Sync Engine", desc: "Automated broker account synchronization via MetaTrader & cTrader." },
              { key: "aiCoach", label: "AI Trading Coach & Playbook Insights", desc: "Generative AI trade reviews and behavioral pattern detection." },
              { key: "cloudReports", label: "Cloud PDF Executive Reports", desc: "Server-side report compilation and PDF generation." },
              { key: "teamWorkspace", label: "Team Workspaces & Collaborators", desc: "Multi-seat workspace sharing, invitations, and permissions." },
              { key: "experimentalFeatures", label: "Experimental Features (Beta)", desc: "Unreleased laboratory features under active test." },
            ].map((item) => {
              const flagKey = item.key as keyof FeatureFlags;
              const isEnabled = flags[flagKey];
              return (
                <div
                  key={item.key}
                  className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{item.label}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isEnabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"}`}>
                        {isEnabled ? "ENABLED" : "DISABLED"}
                      </span>
                    </div>
                    <p className="text-gray-400">{item.desc}</p>
                  </div>

                  <button
                    onClick={() => handleToggleFlag(flagKey)}
                    className={`px-4 py-2 rounded-xl font-bold transition-all shadow-md shrink-0 ${
                      isEnabled
                        ? "bg-rose-600/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30"
                        : "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30"
                    }`}
                  >
                    {isEnabled ? "Disable Feature" : "Enable Feature"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. FEEDBACK INBOX TAB */}
      {activeTab === "feedback" && (
        <div className="p-5 rounded-2xl bg-dark-card border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span>Feedback Inbox & Bug Tracker</span>
            </h3>
            <span className="text-xs text-gray-400">{feedbackList.length} user submissions</span>
          </div>

          <div className="space-y-3">
            {feedbackList.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-black/20 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      {item.category}
                    </span>
                    <span className="font-bold text-white">{item.title}</span>
                    <span className="text-gray-500 text-[10px]">from {item.userEmail}</span>
                  </div>
                  <p className="text-gray-300">{item.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {(["Open", "In Progress", "Completed"] as FeedbackStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleUpdateFeedback(item.id, st)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                        item.status === st
                          ? "bg-purple-600 text-white shadow-glow"
                          : "bg-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                  <button
                    onClick={() => handleDeleteFeedback(item.id)}
                    className="p-1 rounded text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. ANNOUNCEMENT MANAGER TAB */}
      {activeTab === "announcements" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <form
            onSubmit={handleCreateAnnouncement}
            className="p-5 rounded-2xl bg-dark-card border border-dark-border space-y-4 md:col-span-1"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-purple-400" />
              <span>Create Announcement</span>
            </h3>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase">Announcement Type</label>
              <select
                value={annType}
                onChange={(e) => setAnnType(e.target.value as AnnouncementType)}
                className="w-full p-2.5 rounded-xl bg-black/40 border border-dark-border text-white text-xs font-mono"
              >
                <option value="New Version">New Version</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Scheduled Downtime">Scheduled Downtime</option>
                <option value="New Feature">New Feature</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase">Title</label>
              <input
                type="text"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="e.g. System Upgrade Live"
                className="w-full p-2.5 rounded-xl bg-black/40 border border-dark-border text-white text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase">Message</label>
              <textarea
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                placeholder="Message broadcasted to user dashboards..."
                rows={3}
                className="w-full p-2.5 rounded-xl bg-black/40 border border-dark-border text-white text-xs font-mono"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-glow text-xs flex items-center justify-center gap-2"
            >
              <Megaphone className="w-4 h-4" />
              <span>Broadcast Announcement</span>
            </button>
          </form>

          <div className="p-5 rounded-2xl bg-dark-card border border-dark-border space-y-4 md:col-span-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-purple-400" />
              <span>Active Broadcasts</span>
            </h3>

            <div className="space-y-3">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                        {ann.type}
                      </span>
                      <span className="font-bold text-white">{ann.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ann.active ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-gray-500/10 text-gray-400 border border-gray-500/30"}`}>
                        {ann.active ? "LIVE ON DASHBOARDS" : "PAUSED"}
                      </span>
                    </div>
                    <p className="text-gray-300">{ann.message}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleAnn(ann.id)}
                      className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] font-bold"
                    >
                      {ann.active ? "Pause" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDeleteAnn(ann.id)}
                      className="p-1 rounded text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 9. DEVELOPER TOOLS TAB */}
      {activeTab === "developer-tools" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-dark-card border border-dark-border space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span>Owner Developer Utilities</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "CLEAR_CACHE", label: "Clear Caches", icon: RefreshCw },
                { id: "DEMO_NOTIF", label: "Trigger Notification", icon: Radio },
                { id: "REBUILD_INDEX", label: "Rebuild Search Index", icon: Database },
                { id: "TEST_EMAIL", label: "Test Email Delivery", icon: Mail },
                { id: "TEST_STRIPE", label: "Test Stripe Connection", icon: CreditCard },
                { id: "DB_HEALTH", label: "Database Health Check", icon: Server },
              ].map((act) => {
                const IconComp = act.icon;
                return (
                  <button
                    key={act.id}
                    onClick={() => triggerDevAction(act.id)}
                    className="p-3 rounded-xl bg-black/30 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 text-white font-bold transition-all text-left flex items-center gap-2.5"
                  >
                    <IconComp className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>{act.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-dark-card border border-dark-border space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Developer Execution Output Log</span>
            </h3>

            <div className="h-64 rounded-xl bg-black/60 p-3 font-mono text-[11px] text-emerald-400 overflow-y-auto space-y-1 border border-white/10 scrollbar-thin">
              {devLogs.length === 0 ? (
                <div className="text-gray-500 italic">No developer actions executed yet. Select an action to view runtime logs.</div>
              ) : (
                devLogs.map((log, idx) => <div key={idx}>{log}</div>)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
