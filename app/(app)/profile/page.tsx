"use client";

import React from "react";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white font-mono">
          Trader Profile & Identity
        </h1>
        <p className="text-xs text-gray-400 font-mono mt-1">
          Manage your personal branding, regional localization, and institutional trader bio.
        </p>
      </div>

      <ProfileForm />
    </div>
  );
}
