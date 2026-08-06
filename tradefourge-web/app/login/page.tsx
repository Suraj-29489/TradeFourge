"use client";

import React from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { useTheme } from "@/context/ThemeContext";

export default function LoginPage() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center p-6 font-mono selection:bg-emerald-600 selection:text-white transition-colors duration-250 ${
      isLight ? "bg-[#F8FAFC] text-slate-900" : "bg-[#080B11] text-gray-100"
    }`}>
      <div className="w-full max-w-md space-y-6 text-center my-auto">
        {/* Brand Logo Header */}
        <div className="space-y-3">
          <Link href="/" className="inline-block group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isLight ? "/logo_full_light.png" : "/logo_full.png"}
              alt="TradeFourge Logo"
              className="h-9 w-auto object-contain mx-auto transition-transform group-hover:scale-105"
            />
          </Link>

          <h1 className={`text-2xl font-extrabold tracking-tight font-sans ${
            isLight ? "text-slate-900" : "text-white"
          }`}>
            Welcome back to TradeFourge
          </h1>
        </div>

        {/* Centered Auth Card */}
        <div className={`p-8 rounded-2xl border shadow-2xl space-y-6 text-left ${
          isLight ? "bg-white border-slate-200 shadow-sm text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
        }`}>
          <LoginForm />
        </div>

        {/* Footer */}
        <p className={`text-xs font-mono ${isLight ? "text-slate-500" : "text-gray-500"}`}>
          © {new Date().getFullYear()} TradeFourge Inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}
