"use client";

import React from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#080B11] text-gray-100 flex flex-col justify-center items-center p-6 font-mono selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md space-y-6 text-center my-auto">
        {/* Brand Logo Header */}
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-600/20">
              <Zap className="w-5 h-5 fill-white text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white font-sans">
              TRADE<span className="text-blue-400">FOURGE</span>
            </span>
          </Link>

          <h1 className="text-2xl font-extrabold text-white tracking-tight font-sans">
            Welcome back to TradeFourge
          </h1>
        </div>

        {/* Centered Dark Auth Card */}
        <div className="p-8 rounded-2xl bg-[#0F141C] border border-white/[0.08] shadow-2xl space-y-6 text-left">
          <LoginForm />
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-500 font-mono">
          © {new Date().getFullYear()} TradeFourge Inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}
