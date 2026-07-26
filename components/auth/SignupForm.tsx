"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";

export const SignupForm: React.FC = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Full Name */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono font-medium text-gray-300 block">
          Full Name
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <User className="w-4 h-4" />
          </div>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Rivers"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono font-medium text-gray-300 block">
          Work / Trading Email
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Mail className="w-4 h-4" />
          </div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="trader@tradefourge.com"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono font-medium text-gray-300 block">
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-white"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Terms Checkbox */}
      <div className="flex items-start pt-1">
        <input
          type="checkbox"
          id="terms"
          required
          checked={agreedTerms}
          onChange={(e) => setAgreedTerms(e.target.checked)}
          className="w-4 h-4 mt-0.5 rounded border-gray-700 bg-white/5 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900 cursor-pointer"
        />
        <label htmlFor="terms" className="ml-2.5 text-xs text-gray-400 leading-snug">
          I agree to TradeFourge's{" "}
          <a href="#terms" className="text-purple-400 hover:underline">Terms of Service</a>{" "}
          and{" "}
          <a href="#privacy" className="text-purple-400 hover:underline">Privacy Policy</a>.
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-glow flex items-center justify-center gap-2 transition-all active:scale-95 mt-2"
      >
        <span>Create Free Account</span>
        <ArrowRight className="w-4 h-4" />
      </button>

      {/* Security badge */}
      <div className="pt-2 text-center text-[11px] font-mono text-gray-500 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Free 14-Day Pro Trial Included · No Credit Card Required
      </div>

      {/* Link to Login */}
      <div className="pt-2 text-center text-xs text-gray-400 border-t border-white/10">
        Already have an account?{" "}
        <Link href="/login" className="text-purple-400 font-bold hover:underline">
          Sign In
        </Link>
      </div>
    </form>
  );
};
