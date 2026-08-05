"use client";

import React from "react";
import { Bell, ShieldCheck, Zap, Sparkles, CheckCircle2 } from "lucide-react";

export default function NotificationsPage() {
  const NOTIFICATIONS = [
    {
      id: 1,
      title: "TradeFourge SaaS v2.5.0 Deployment Complete",
      description: "User profiles, customizable settings, and Supabase cloud storage synchronization are live.",
      time: "Just now",
      icon: Sparkles,
      iconColor: "text-purple-400",
    },
    {
      id: 2,
      title: "Supabase Security RLS Active",
      description: "Row Level Security policies verified for profiles, preferences, and trade image storage.",
      time: "10 minutes ago",
      icon: ShieldCheck,
      iconColor: "text-emerald-400",
    },
    {
      id: 3,
      title: "Welcome to TradeFourge Terminal",
      description: "Your 14-day institutional AI analytics trial has started.",
      time: "1 hour ago",
      icon: Zap,
      iconColor: "text-indigo-400",
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white font-mono">
          Notification Activity Center
        </h1>
        <p className="text-xs text-gray-400 font-mono mt-1">
          Stay updated with trade execution alerts, system updates, and security notifications.
        </p>
      </div>

      <div className="space-y-3">
        {NOTIFICATIONS.map((n) => {
          const Icon = n.icon;
          return (
            <div
              key={n.id}
              className="p-4 rounded-2xl bg-[#111726] border border-white/10 flex items-start gap-4 hover:border-purple-500/30 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className={`w-5 h-5 ${n.iconColor}`} />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold font-mono text-white">{n.title}</h3>
                  <span className="text-[10px] font-mono text-gray-500">{n.time}</span>
                </div>
                <p className="text-xs text-gray-400 font-sans leading-relaxed">{n.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
