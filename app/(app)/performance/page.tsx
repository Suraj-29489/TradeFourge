"use client";
// app/(app)/performance/page.tsx
// Dedicated Performance Diagnostics Lab Workspace.

import React from "react";
import { StatisticsView } from "@/components/statistics/StatisticsView";

export default function PerformancePage() {
  return (
    <div className="space-y-6">
      <StatisticsView />
    </div>
  );
}
