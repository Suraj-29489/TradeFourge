"use client";

import React from "react";
import { User } from "lucide-react";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default function ProfilePage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full text-gray-200 font-mono pb-12">
      <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08]">
        <h1 className="text-2xl font-extrabold tracking-tight text-white font-sans flex items-center gap-2">
          <User className="w-6 h-6 text-blue-400" />
          <span>Trader Profile & Identity</span>
        </h1>
        <p className="text-xs text-gray-400 font-sans mt-1">
          Manage your personal branding, regional localization, and institutional trader bio.
        </p>
      </div>

      <ProfileForm />
    </div>
  );
}
