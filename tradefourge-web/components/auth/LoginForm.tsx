"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl, sanitizeSupabaseUrl } from "@/lib/supabase/config";
import { useOnboardingStore } from "@/lib/store/useOnboardingStore";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isVerifiedNotice, setIsVerifiedNotice] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const verifiedParam = searchParams.get("verified");

    if (errorParam) {
      setErrorMessage(decodeURIComponent(errorParam));
    }

    if (verifiedParam === "true") {
      setIsVerifiedNotice(true);
      setSuccessMessage("Your email has been verified successfully. Please sign in to continue.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!envUrl || !envKey || envUrl.includes("placeholder") || envKey.includes("placeholder")) {
      setErrorMessage("Supabase project credentials missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      } else if (data.session) {
        setSuccessMessage("Authentication successful. Verification complete...");
        const hasCompletedOnboarding = useOnboardingStore.getState().hasCompletedOnboarding;
        setTimeout(() => {
          if (!hasCompletedOnboarding) {
            router.push("/connect");
          } else {
            router.push("/dashboard");
          }
          router.refresh();
        }, 300);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred during sign in.");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);

    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!envUrl || !envKey || envUrl.includes("placeholder") || envKey.includes("placeholder")) {
      setErrorMessage("Supabase project credentials missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      setGoogleLoading(false);
      return;
    }

    try {
      const callbackUrl = getAuthCallbackUrl("/auth/callback");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setGoogleLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Google OAuth sign in failed.");
      setGoogleLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email Verified Banner (Cross-device support) */}
      {isVerifiedNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 space-y-1.5 shadow-glow">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Email Verified Successfully</span>
          </div>
          <p className="text-xs text-emerald-200/90 leading-relaxed">
            Your account is active. Please sign in below to open your TradeFourge terminal.
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && !isVerifiedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Email Input */}
      <div className="space-y-1.5 font-mono">
        <label className="text-[11px] font-medium text-gray-300 block">
          Email Address
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
            placeholder="name@company.com"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono"
          />
        </div>
      </div>

      {/* Password Input */}
      <div className="space-y-1.5 font-mono">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-gray-300 block">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono"
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

      {/* Remember me checkbox */}
      <div className="flex items-center select-none font-mono">
        <input
          type="checkbox"
          id="remember"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="w-4 h-4 rounded border-white/20 bg-white/[0.03] text-blue-600 focus:ring-blue-500/50 cursor-pointer"
        />
        <label htmlFor="remember" className="ml-2 text-xs text-gray-300 cursor-pointer">
          Remember this session
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>{isVerifiedNotice ? "Continue to Sign In" : "Sign In"}</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Social Divider */}
      <div className="relative my-4 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/[0.08]" />
        </div>
        <span className="relative px-3 bg-[#0F141C] text-[10px] font-mono text-gray-400 uppercase tracking-wider">
          Or Continue With
        </span>
      </div>

      {/* Google OAuth Button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="w-full py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-gray-200 font-medium font-mono text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
      >
        {googleLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
              />
            </svg>
            <span>Sign In with Google</span>
          </>
        )}
      </button>

      {/* Link to Signup */}
      <div className="pt-2 text-center text-xs font-mono text-gray-400">
        Don't have an account?{" "}
        <Link href="/signup" className="text-blue-400 font-bold hover:underline">
          Sign up
        </Link>
      </div>
    </form>
  );
}

export const LoginForm: React.FC = () => {
  return (
    <Suspense fallback={<div className="text-center py-6 text-xs text-gray-400 font-mono">Loading TradeFourge Auth...</div>}>
      <LoginFormContent />
    </Suspense>
  );
};
