"use client";

import React, { useEffect, useState } from "react";
import { getActiveAnnouncements, Announcement } from "@/lib/admin/announcements";
import { X, Info, AlertTriangle, Sparkles, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "tf_dismissed_announcements_v4";

export const AnnouncementBanner: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const loadAnnouncements = () => {
    setAnnouncements(getActiveAnnouncements());
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setDismissedIds(JSON.parse(saved));
        }
      } catch {}
    }

    loadAnnouncements();
    const handler = () => loadAnnouncements();
    window.addEventListener("tf-announcements-changed", handler);
    return () => window.removeEventListener("tf-announcements-changed", handler);
  }, []);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = [...prev, id];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

  const visibleAnnouncements = announcements.filter((a) => !dismissedIds.includes(a.id));

  if (visibleAnnouncements.length === 0) return null;

  const getBadgeStyle = (type: Announcement["type"]) => {
    switch (type) {
      case "Maintenance":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
          icon: ShieldAlert,
        };
      case "Scheduled Downtime":
        return {
          bg: "bg-rose-500/10 border-rose-500/30 text-rose-400",
          icon: AlertTriangle,
        };
      case "New Feature":
        return {
          bg: "bg-blue-500/10 border-blue-500/30 text-blue-400",
          icon: Sparkles,
        };
      default:
        return {
          bg: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400",
          icon: Info,
        };
    }
  };

  return (
    <div className="space-y-3 font-mono text-xs">
      <AnimatePresence>
        {visibleAnnouncements.map((ann) => {
          const style = getBadgeStyle(ann.type);
          const IconComponent = style.icon;
          return (
            <motion.div
              key={ann.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className={`p-4 rounded-xl border flex items-start justify-between gap-4 shadow-lg ${style.bg}`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-black/20 shrink-0 mt-0.5">
                  <IconComponent className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white tracking-wide font-sans">{ann.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-black/30 border border-white/10">
                      {ann.type}
                    </span>
                  </div>
                  <p className="text-gray-300 mt-1 leading-relaxed text-xs font-sans">{ann.message}</p>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(ann.id)}
                className="p-1 rounded bg-black/20 text-gray-400 hover:text-white transition-colors"
                title="Dismiss Announcement"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
