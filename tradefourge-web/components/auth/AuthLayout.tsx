"use client";

import React from "react";
import Link from "next/link";
import { Zap, ShieldCheck, TrendingUp, Brain, CheckCircle2 } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-[#080B11] text-gray-100 flex flex-col justify-between selection:bg-purple-600 selection:text-white">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        {/* Left Side: Branding & Feature Highlights (Hidden on mobile, 5 cols on lg) */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-[#0F1420] via-[#111726] to-[#080B11] border-r border-white/10 p-12 flex-col justify-between relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Logo Header */}
          <div className="relative z-10">
            <Link href="/" className="inline-block group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo_full.png"
                alt="TradeFourge Logo"
                className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
              />
            </Link>
          </div>

          {/* Middle Value Proposition */}
          <div className="relative z-10 space-y-8 my-auto">
            <div className="space-y-3">
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono font-bold uppercase">
                Institutional SaaS Terminal
              </span>
              <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
                Master Your Trading Edge With Data Intelligence
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                Join thousands of disciplined traders using TradeFourge to track performance, eliminate tilt, and audit equity curves.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3 text-sm text-gray-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Instant MT4/MT5 position parser engine</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-gray-300">
                <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <span>AI Coach pattern & drawdown alerts</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-gray-300">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <span>Audited PDF & Excel investor statements</span>
              </div>
            </div>
          </div>

          {/* Footer Quote / Badge */}
          <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs font-mono text-gray-400">
            <span>© {new Date().getFullYear()} TradeFourge Inc.</span>
            <span className="text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> 256-Bit Encrypted
            </span>
          </div>
        </div>

        {/* Right Side: Auth Form Container (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col justify-center items-center p-6 sm:p-12 relative bg-[#090D14]">
          {/* Mobile Back Link */}
          <div className="absolute top-6 left-6 lg:hidden">
            <Link href="/" className="flex items-center gap-2 text-xs font-mono text-blue-400 hover:text-blue-300">
              <Zap className="w-4 h-4" /> TRADEFOURGE
            </Link>
          </div>

          <div className="w-full max-w-md space-y-6 my-auto">
            <div className="space-y-1.5 text-center lg:text-left">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
                {title}
              </h1>
              <p className="text-xs text-gray-400 font-mono">
                {subtitle}
              </p>
            </div>

            {/* Main Auth Form Box */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0F141C] border border-white/[0.08] shadow-xl space-y-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

