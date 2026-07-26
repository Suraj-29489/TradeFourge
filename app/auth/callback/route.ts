import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";

function isPkceMismatchError(errMessage?: string | null): boolean {
  if (!errMessage) return false;
  const msg = errMessage.toLowerCase();
  return (
    msg.includes("code challenge") ||
    msg.includes("code_verifier") ||
    msg.includes("flow_state") ||
    msg.includes("verifier") ||
    msg.includes("pkce")
  );
}

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
    if (isPkceMismatchError(errorDescription || errorParam)) {
      const verifiedUrl = new URL("/login", origin);
      verifiedUrl.searchParams.set("verified", "true");
      return NextResponse.redirect(verifiedUrl);
    }

    const loginErrorUrl = new URL("/login", origin);
    loginErrorUrl.searchParams.set("error", errorDescription || errorParam || "auth_callback_failed");
    return NextResponse.redirect(loginErrorUrl);
  }

  const supabase = await createClient();

  // 1. Handle PKCE code exchange (OAuth & Email Link Confirmation)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Same-device verification: session created automatically, open dashboard
      return NextResponse.redirect(new URL(targetPath, origin));
    } else {
      // Cross-device verification: PKCE verifier lives on signup device.
      // Account is verified in Supabase, gracefully redirect to login with verified notice.
      if (isPkceMismatchError(error.message)) {
        const verifiedUrl = new URL("/login", origin);
        verifiedUrl.searchParams.set("verified", "true");
        return NextResponse.redirect(verifiedUrl);
      }

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
      if (isPkceMismatchError(error.message)) {
        const verifiedUrl = new URL("/login", origin);
        verifiedUrl.searchParams.set("verified", "true");
        return NextResponse.redirect(verifiedUrl);
      }

      const loginErrorUrl = new URL("/login", origin);
      loginErrorUrl.searchParams.set("error", error.message);
      return NextResponse.redirect(loginErrorUrl);
    }
  }

  // If no auth code/token is present, redirect to login
  return NextResponse.redirect(new URL("/login", origin));
}
