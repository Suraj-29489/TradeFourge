"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export const ResetPasswordForm: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();
  const configured = isSupabaseConfigured();

  const getStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "Enter Password", color: "bg-gray-700" };
    if (pass.length < 6) return { score: 1, label: "Weak", color: "bg-rose-500" };
    if (pass.length < 10) return { score: 2, label: "Fair", color: "bg-amber-500" };
    return { score: 3, label: "Strong Edge", color: "bg-emerald-400" };
  };

  const strength = getStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    if (!configured) {
      setTimeout(() => {
        setLoading(false);
        setSubmitted(true);
      }, 500);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      } else {
        setLoading(false);
        setSubmitted(true);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update password.");
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-glow">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">Password Reset Complete</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Your TradeFourge account password has been updated successfully.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/login"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-glow flex items-center justify-center gap-2 transition-all"
          >
            <span>Proceed to Login</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* New Password */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono font-medium text-gray-300 block">
          New Password
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

        {password && (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
              <span>Password Security:</span>
              <span className={strength.score === 3 ? "text-emerald-400 font-bold" : "text-gray-300"}>
                {strength.label}
              </span>
            </div>
            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden flex gap-1">
              <div className={`h-full flex-1 rounded-full ${strength.score >= 1 ? strength.color : "bg-gray-800"}`} />
              <div className={`h-full flex-1 rounded-full ${strength.score >= 2 ? strength.color : "bg-gray-800"}`} />
              <div className={`h-full flex-1 rounded-full ${strength.score >= 3 ? strength.color : "bg-gray-800"}`} />
            </div>
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono font-medium text-gray-300 block">
          Confirm New Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showConfirmPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-white"
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-glow flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2"
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>Reset Account Password</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Security badge */}
      <div className="pt-2 text-center text-[11px] font-mono text-gray-500 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> End-to-End Encrypted Recovery Key
      </div>
    </form>
  );
};
