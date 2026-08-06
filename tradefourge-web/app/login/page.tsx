"use client";

import React from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-6 selection:bg-slate-900 selection:text-white font-sans">
      <div className="w-full max-w-sm space-y-8 text-center my-auto">
        {/* Brand Logo Header */}
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 font-sans">
              TradeFourge
            </span>
          </Link>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back to TradeFourge
          </h1>
        </div>

        {/* Centered Login Form Card */}
        <div className="p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xl shadow-slate-200/50">
          <LoginForm />
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-400 font-sans">
          © {new Date().getFullYear()} TradeFourge Inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}
