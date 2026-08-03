"use client";
// app/(app)/mission-control/page.tsx
// TradeFourge v5.0 Mission Control SaaS Operations & Telemetry Center

import React, { useEffect, useState } from "react";
import { getSystemHealthSummary, SystemHealthSummary, recordTelemetryEvent } from "@/lib/monitoring/monitoring-service";
import { fetchTeamWorkspace, inviteTeamMember, revokeInvitation, TeamWorkspace, TeamRole } from "@/lib/teams/teams-service";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  ShieldCheck,
  Zap,
  Users,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Mail,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

export default function MissionControlPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [health, setHealth] = useState<SystemHealthSummary | null>(null);
  const [workspace, setWorkspace] = useState<TeamWorkspace | null>(null);
  const [activeTab, setActiveTab] = useState<"telemetry" | "team">("telemetry");

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("Member");

  const loadData = (uid: string) => {
    setHealth(getSystemHealthSummary());
    setWorkspace(fetchTeamWorkspace(uid));
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        loadData(user.id);
      }
    })();
  }, []);

  const handleInvite = () => {
    if (!userId || !inviteEmail) return;
    inviteTeamMember(userId, inviteEmail, inviteRole);
    recordTelemetryEvent("AUTH_EVENT", "INFO", `Invited team member ${inviteEmail} as ${inviteRole}.`);
    setInviteEmail("");
    loadData(userId);
  };

  const handleRevoke = (invId: string) => {
    if (!userId) return;
    revokeInvitation(userId, invId);
    loadData(userId);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-400" />
            <span>Mission Control SaaS Operations Center</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time telemetry, error monitoring, system health, and team workspace administration
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Systems Normal (99.98%)</span>
          </span>
        </div>
      </div>

      {/* SaaS Key Metrics Overview Grid */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
            <span className="text-gray-400 text-[10px] block">MONTHLY RECURRING REVENUE</span>
            <span className="text-xl font-extrabold text-emerald-400 font-mono">
              ${health.monthlyRecurringRevenue.toLocaleString()} USD
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
            <span className="text-gray-400 text-[10px] block">ACTIVE SUBSCRIPTIONS</span>
            <span className="text-xl font-extrabold text-purple-400 font-mono">
              {health.activeSubscriptionsCount.toLocaleString()}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
            <span className="text-gray-400 text-[10px] block">LIVE SYNC ENGINE</span>
            <span className="text-xl font-extrabold text-white font-mono flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{health.liveSyncEngineStatus}</span>
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-1">
            <span className="text-gray-400 text-[10px] block">TELEMETRY UPTIME</span>
            <span className="text-xl font-extrabold text-white font-mono">
              {health.uptimePercentage}%
            </span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-dark-border pb-3">
        <button
          onClick={() => setActiveTab("telemetry")}
          className={`px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 ${
            activeTab === "telemetry"
              ? "bg-purple-600/20 border border-purple-500/30 text-purple-300"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Production Telemetry Logs</span>
        </button>

        <button
          onClick={() => setActiveTab("team")}
          className={`px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 ${
            activeTab === "team"
              ? "bg-purple-600/20 border border-purple-500/30 text-purple-300"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Workspace Administration</span>
        </button>
      </div>

      {/* TAB 1: PRODUCTION TELEMETRY LOGS */}
      {activeTab === "telemetry" && health && (
        <div className="space-y-4">
          <div className="rounded-2xl glass-card border border-dark-border overflow-hidden">
            <div className="p-4 bg-black/30 border-b border-white/10 flex items-center justify-between">
              <span className="font-bold text-white">Live System Events & Failure Logs</span>
              <button
                onClick={() => userId && loadData(userId)}
                className="p-1 rounded text-gray-400 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-white/5 font-mono text-xs">
              {health.lastTelemetryLogs.map((log) => (
                <div key={log.id} className="p-3.5 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        log.severity === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : log.severity === "WARNING"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}>
                        {log.severity}
                      </span>
                      <span className="text-[10px] text-purple-400 font-bold">{log.category}</span>
                      <span className="text-[10px] text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-gray-200">{log.message}</p>
                  </div>

                  <span className="text-[10px] text-gray-500 shrink-0 font-mono">{log.id}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEAM WORKSPACE ADMINISTRATION */}
      {activeTab === "team" && workspace && (
        <div className="space-y-6">
          {/* Invite Form */}
          <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-purple-400" />
              <span>Invite Member to Desk Workspace</span>
            </h3>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="colleague@tradingdesk.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-dark-card border border-white/10 text-white focus:outline-none focus:border-purple-500"
              />

              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                className="px-3 py-2 rounded-xl bg-dark-card border border-white/10 text-white focus:outline-none"
              >
                <option value="Admin">Admin (Full Access)</option>
                <option value="Member">Member (Trader Access)</option>
                <option value="Viewer">Viewer (Read Only)</option>
              </select>

              <button
                onClick={handleInvite}
                disabled={!inviteEmail}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-40 shrink-0"
              >
                Send Invitation
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
            <h3 className="text-sm font-bold text-white">Active Desk Members ({workspace.members.length})</h3>
            <div className="divide-y divide-white/5">
              {workspace.members.map((mem) => (
                <div key={mem.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">{mem.name}</span>
                    <span className="text-[10px] text-gray-400">{mem.email}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px]">
                    {mem.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Invitations Table */}
          {workspace.invitations.length > 0 && (
            <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
              <h3 className="text-sm font-bold text-white">Pending Invitations ({workspace.invitations.length})</h3>
              <div className="divide-y divide-white/5">
                {workspace.invitations.map((inv) => (
                  <div key={inv.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">{inv.email}</span>
                      <span className="text-[10px] text-gray-400">Role: {inv.role} · Status: {inv.status}</span>
                    </div>

                    <button
                      onClick={() => handleRevoke(inv.id)}
                      className="p-1.5 rounded text-rose-400 hover:bg-rose-500/10"
                      title="Revoke invitation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
