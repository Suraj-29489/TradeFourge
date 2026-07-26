"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl, sanitizeSupabaseUrl } from "@/lib/supabase/config";

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

  const supabase = createClient();

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setErrorMessage(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

    console.log("[LoginForm.tsx:handleSubmit]", {
      file: "components/auth/LoginForm.tsx",
      function: "handleSubmit",
      line: 25,
      parameters: { email: email.trim() },
      supabaseUrl,
      callingFunction: "supabase.auth.signInWithPassword",
    });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      console.log("[LoginForm.tsx:signInWithPassword:Response]", {
        file: "components/auth/LoginForm.tsx",
        function: "supabase.auth.signInWithPassword",
        data,
        error,
        errorMessage: error?.message,
        status: error?.status,
        code: error?.code,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      } else if (data.session) {
        setSuccessMessage("Authentication successful. Opening terminal...");
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 300);
      }
    } catch (err: any) {
      console.error("[LoginForm.tsx:signInWithPassword:CatchError]", err);
      setErrorMessage(err?.message || "An unexpected error occurred during sign in.");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);

    const supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const callbackUrl = getAuthCallbackUrl("/auth/callback");

    console.log("[LoginForm.tsx:handleGoogleSignIn]", {
      file: "components/auth/LoginForm.tsx",
      function: "handleGoogleSignIn",
      redirectTo: callbackUrl,
      supabaseUrl,
      callingFunction: "supabase.auth.signInWithOAuth",
    });

    try {
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
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Email Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono font-medium text-gray-300 block">
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
            placeholder="trader@tradefourge.com"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
        </div>
      </div>

      {/* Password Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono font-medium text-gray-300 block">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-mono text-purple-400 hover:text-purple-300 transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
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

      {/* Remember me checkbox */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="remember"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="w-4 h-4 rounded border-gray-700 bg-white/5 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900 cursor-pointer"
        />
        <label htmlFor="remember" className="ml-2.5 text-xs text-gray-300 cursor-pointer">
          Remember this session for 30 days
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-glow flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>Sign In to Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Social Divider */}
      <div className="relative my-4 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <span className="relative px-3 bg-[#111726] text-[11px] font-mono text-gray-500 uppercase">
          Or Continue With
        </span>
      </div>

      {/* Google OAuth Button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
      <div className="pt-2 text-center text-xs text-gray-400">
        Don't have a TradeFourge account?{" "}
        <Link href="/signup" className="text-purple-400 font-bold hover:underline">
          Create Account
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
