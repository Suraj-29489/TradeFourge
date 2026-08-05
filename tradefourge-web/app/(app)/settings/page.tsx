"use client";

import React from "react";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white font-mono">
          Terminal & SaaS Settings
        </h1>
        <p className="text-xs text-gray-400 font-mono mt-1">
          Configure regional formatting, notifications, trading preferences, and terminal layout.
        </p>
      </div>

      <SettingsTabs />
    </div>
  );
}
