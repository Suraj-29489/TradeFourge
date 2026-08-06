"use client";

import React from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#080B11] text-gray-100 flex flex-col justify-center items-center p-6 font-mono selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md space-y-6 text-center my-auto">
        {/* Brand Logo Header */}
        <div className="space-y-3">
          <Link href="/" className="inline-block group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_full.png"
              alt="TradeFourge Logo"
              className="h-9 w-auto object-contain mx-auto transition-transform group-hover:scale-105"
            />
          </Link>

          <h1 className="text-2xl font-extrabold text-white tracking-tight font-sans">
            Create your TradeFourge Account
          </h1>
        </div>

        {/* Centered Dark Auth Card */}
        <div className="p-8 rounded-2xl bg-[#0F141C] border border-white/[0.08] shadow-2xl space-y-6 text-left">
          <SignupForm />
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-500 font-mono">
          © {new Date().getFullYear()} TradeFourge Inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}
