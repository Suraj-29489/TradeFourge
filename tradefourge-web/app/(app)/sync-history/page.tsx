"use client";
// app/(app)/sync-history/page.tsx
// TradeFourge v4.0 Sync History Audit Log Page

import React, { useEffect, useState } from "react";
import { SyncHistoryTable } from "@/components/accounts/SyncHistoryTable";
import { createClient } from "@/lib/supabase/client";
import { History, Activity } from "lucide-react";

export default function SyncHistoryPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-400" />
            <span>Sync History Audit Log</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time execution log and metrics for live broker account synchronization cycles
          </p>
        </div>
      </div>

      {/* Sync History Table */}
      {userId ? (
        <SyncHistoryTable userId={userId} />
      ) : (
        <div className="p-8 text-center text-gray-400 text-xs">
          Loading synchronization history...
        </div>
      )}
    </div>
  );
}
