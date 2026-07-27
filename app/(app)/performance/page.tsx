"use client";
// app/(app)/performance/page.tsx
// Dedicated Institutional Performance Lab Workstation.

import React from "react";
import { PerformanceLabView } from "@/components/performance/PerformanceLabView";

export default function PerformancePage() {
  return (
    <div className="space-y-6">
      <PerformanceLabView />
    </div>
  );
}
