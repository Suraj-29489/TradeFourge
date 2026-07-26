/**
 * Utility to resolve the application's base URL for Supabase Auth redirects.
 * Handles local development, Vercel deployments, and custom production domains.
 */
export function getSiteUrl(): string {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  // Ensure url includes http/https protocol
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  // Remove trailing slash
  return url.replace(/\/$/, "");
}

/**
 * Construct redirect URL for Supabase Auth callbacks
 */
export function getAuthCallbackUrl(nextPath: string = "/dashboard"): string {
  const baseUrl = getSiteUrl();
  const cleanPath = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `${baseUrl}/auth/callback?next=${encodeURIComponent(cleanPath)}`;
}
