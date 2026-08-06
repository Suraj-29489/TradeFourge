"use client";

import React from "react";
import Link from "next/link";
import { Zap, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className={`min-h-screen flex flex-col justify-between selection:bg-emerald-600 selection:text-white transition-colors duration-250 ${
      isLight ? "bg-[#F8FAFC] text-slate-900" : "bg-[#080B11] text-gray-100"
    }`}>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        {/* Left Side: Branding & Feature Highlights */}
        <div className={`hidden lg:flex lg:col-span-5 p-12 flex-col justify-between relative overflow-hidden border-r transition-colors duration-250 ${
          isLight ? "bg-slate-50 border-slate-200" : "bg-gradient-to-br from-[#0F1420] via-[#111726] to-[#080B11] border-white/10"
        }`}>
          {/* Ambient Glow */}
          <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
            isLight ? "bg-emerald-500/10" : "bg-blue-600/20"
          }`} />

          {/* Logo Header */}
          <div className="relative z-10">
            <Link href="/" className="inline-block group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={isLight ? "/logo_full_light.png" : "/logo_full.png"}
                alt="TradeFourge Logo"
                className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
              />
            </Link>
          </div>

          {/* Middle Value Proposition */}
          <div className="relative z-10 space-y-8 my-auto">
            <div className="space-y-3">
              <span className={`px-3 py-1 rounded-full border text-xs font-mono font-bold uppercase ${
                isLight ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : "bg-blue-500/20 text-blue-300 border-blue-500/30"
              }`}>
                Institutional SaaS Terminal
              </span>
              <h2 className={`text-3xl font-extrabold tracking-tight leading-tight ${isLight ? "text-slate-900" : "text-white"}`}>
                Master Your Trading Edge With Data Intelligence
              </h2>
              <p className={`text-sm leading-relaxed ${isLight ? "text-slate-600" : "text-gray-400"}`}>
                Join thousands of disciplined traders using TradeFourge to track performance, eliminate tilt, and audit equity curves.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className={`flex items-start gap-3 text-sm ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Instant MT4/MT5 position parser engine</span>
              </div>
              <div className={`flex items-start gap-3 text-sm ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>AI Coach pattern & drawdown alerts</span>
              </div>
              <div className={`flex items-start gap-3 text-sm ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Audited PDF & Excel investor statements</span>
              </div>
            </div>
          </div>

          {/* Footer Quote / Badge */}
          <div className={`relative z-10 pt-6 border-t flex items-center justify-between text-xs font-mono ${
            isLight ? "border-slate-200 text-slate-500" : "border-white/10 text-gray-400"
          }`}>
            <span>© {new Date().getFullYear()} TradeFourge Inc.</span>
            <span className="text-emerald-500 flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-4 h-4" /> 256-Bit Encrypted
            </span>
          </div>
        </div>

        {/* Right Side: Auth Form Container */}
        <div className={`lg:col-span-7 flex flex-col justify-center items-center p-6 sm:p-12 relative ${
          isLight ? "bg-[#F8FAFC]" : "bg-[#090D14]"
        }`}>
          {/* Mobile Back Link */}
          <div className="absolute top-6 left-6 lg:hidden">
            <Link href="/" className="flex items-center gap-2 text-xs font-mono text-emerald-600 hover:text-emerald-700">
              <Zap className="w-4 h-4" /> TRADEFOURGE
            </Link>
          </div>

          <div className="w-full max-w-md space-y-6 my-auto">
            <div className="space-y-1.5 text-center lg:text-left">
              <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-sans ${
                isLight ? "text-slate-900" : "text-white"
              }`}>
                {title}
              </h1>
              <p className={`text-xs font-mono ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                {subtitle}
              </p>
            </div>

            {/* Main Auth Form Box */}
            <div className={`p-6 sm:p-8 rounded-2xl border shadow-xl space-y-6 ${
              isLight ? "bg-white border-slate-200 shadow-sm text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
            }`}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
