"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl, sanitizeSupabaseUrl } from "@/lib/supabase/config";

export const SignupForm: React.FC = () => {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const callbackUrl = getAuthCallbackUrl("/auth/callback");

    console.log("[SignupForm.tsx:handleSubmit:Tracing]", {
      file: "components/auth/SignupForm.tsx",
      function: "handleSubmit",
      parameters: { email: email.trim(), fullName: fullName.trim() },
      redirectTo: callbackUrl,
      supabaseUrl,
      callingFunction: "supabase.auth.signUp",
    });

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: callbackUrl,
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      console.log("[SignupForm.tsx:signUp:ResponseTracing]", {
        file: "components/auth/SignupForm.tsx",
        function: "supabase.auth.signUp",
        userCreated: Boolean(data?.user),
        userIdentities: data?.user?.identities,
        hasSession: Boolean(data?.session),
        error,
        errorMessage: error?.message,
        status: error?.status,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        // Supabase returns user with empty identities array when email is already registered
        setErrorMessage("An account with this email address already exists. Please Sign In instead.");
        setLoading(false);
      } else if (data.session) {
        // Immediate session granted (e.g. Email confirmation disabled in Supabase)
        setSuccessMessage("Account created successfully! Redirecting to terminal...");
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 500);
      } else if (data.user) {
        // New user created in auth.users, verification email link dispatched
        setSuccessMessage("Account created! Verification email sent to your inbox.");
        setTimeout(() => {
          router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        }, 800);
      } else {
        setErrorMessage("Signup request sent, but no user record was returned.");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("[SignupForm.tsx:signUp:CatchError]", err);
      setErrorMessage(err?.message || "An unexpected error occurred during signup.");
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);

    const supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const callbackUrl = getAuthCallbackUrl("/auth/callback");

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
      setErrorMessage(err?.message || "Google sign up failed.");
      setGoogleLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-glow flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2"
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>Create Free Account</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Google Sign Up */}
      <button
        type="button"
        onClick={handleGoogleSignUp}
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
            <span>Sign Up with Google</span>
          </>
        )}
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
