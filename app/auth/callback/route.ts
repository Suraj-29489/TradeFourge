import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextParam = requestUrl.searchParams.get("next");
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Determine target redirect path safely
  let targetPath = "/dashboard";
  if (nextParam && nextParam.startsWith("/")) {
    targetPath = nextParam;
  }

  // Handle explicit error from Supabase redirect
  if (errorParam || errorDescription) {
    const loginErrorUrl = new URL("/login", origin);
    loginErrorUrl.searchParams.set("error", errorDescription || errorParam || "auth_callback_failed");
    return NextResponse.redirect(loginErrorUrl);
  }

  const supabase = await createClient();

  // 1. Handle PKCE code exchange (OAuth & Email Confirmation)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(targetPath, origin));
    } else {
      const loginErrorUrl = new URL("/login", origin);
      loginErrorUrl.searchParams.set("error", error.message);
      return NextResponse.redirect(loginErrorUrl);
    }
  }

  // 2. Handle token_hash & type (Supabase OTP / Recovery / Magic Link)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });
    if (!error) {
      return NextResponse.redirect(new URL(targetPath, origin));
    } else {
      const loginErrorUrl = new URL("/login", origin);
      loginErrorUrl.searchParams.set("error", error.message);
      return NextResponse.redirect(loginErrorUrl);
    }
  }

  // If no auth code/token is present, redirect to login
  return NextResponse.redirect(new URL("/login", origin));
}
