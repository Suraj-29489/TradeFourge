"use client";

import React from "react";
import { ShieldCheck, Lock, Smartphone, Laptop, KeyRound } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white font-mono">
          Security & Session Management
        </h1>
        <p className="text-xs text-gray-400 font-mono mt-1">
          Configure two-factor authentication, active devices, and password credentials.
        </p>
      </div>

      <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-6">
        <h2 className="text-sm font-bold font-mono text-white flex items-center gap-2 border-b border-white/10 pb-3">
          <Smartphone className="w-4 h-4 text-emerald-400" /> Multi-Factor Authentication (2FA)
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
          <div>
            <div className="text-xs font-mono font-bold text-white">Authenticator App (TOTP)</div>
            <div className="text-[11px] text-gray-400">Use 1Password, Google Authenticator, or Authy to generate 6-digit verification codes.</div>
          </div>

          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-mono text-xs font-bold shadow-glow shrink-0 transition-all"
          >
            Enable 2FA
          </button>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4">
        <h2 className="text-sm font-bold font-mono text-white flex items-center gap-2 border-b border-white/10 pb-3">
          <Laptop className="w-4 h-4 text-blue-400" /> Authorized Devices & Browser Sessions
        </h2>

        <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between font-mono text-xs text-gray-300">
          <div>
            <div className="font-bold text-white">Chrome on Windows (Current Session)</div>
            <div className="text-[10px] text-gray-500">IP: 182.73.xxx.xxx · Active Now</div>
          </div>

          <div className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 text-[11px] font-bold">
            Active
          </div>
        </div>
      </div>
    </div>
  );
}
