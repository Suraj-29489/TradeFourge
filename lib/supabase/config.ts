/**
 * Utility to sanitize and format the base Supabase URL.
 * Automatically strips accidental `/rest/v1`, `/auth/v1`, or trailing slashes.
 */
export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return "";
  let url = rawUrl.trim();
  url = url.replace(/\/rest\/v1\/?$/i, "");
  url = url.replace(/\/auth\/v1\/?$/i, "");
  url = url.replace(/\/+$/, "");
  return url;
}

/**
 * Utility to resolve the application's base URL for Supabase Auth redirects.
 * Guarantees zero trailing slashes and zero double slashes in constructed path URLs.
 */
export function getSiteUrl(): string {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    (typeof window !== "undefined" && window.location.origin ? window.location.origin : "http://localhost:3000");

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  return url.replace(/\/+$/, "");
}

/**
 * Construct safe redirect URL for Supabase Auth callbacks without double slashes.
 */
export function getAuthCallbackUrl(targetPath: string = "/auth/callback"): string {
  const baseUrl = getSiteUrl();
  const cleanPath = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  return `${baseUrl}${cleanPath}`;
}
