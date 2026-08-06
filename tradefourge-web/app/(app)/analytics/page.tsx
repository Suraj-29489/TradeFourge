"use client";

import React from "react";
import { PerformanceLabView } from "@/components/performance/PerformanceLabView";
import { useActiveAccount } from "@/context/ActiveAccountContext";
import { CompanionAnalyticsView } from "@/components/companion/CompanionAnalyticsView";

export default function AnalyticsPage() {
  const { workspaceMode } = useActiveAccount();

  if (workspaceMode === "tfc") {
    return <CompanionAnalyticsView />;
  }

  return (
    <div className="space-y-6">
      <PerformanceLabView />
    </div>
  );
}
