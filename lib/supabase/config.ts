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
 * Prioritizes NEXT_PUBLIC_SITE_URL as the single source of truth.
 */
export function getSiteUrl(): string {
  let url = process.env.NEXT_PUBLIC_SITE_URL;

  if (!url || url.trim() === "") {
    if (typeof window !== "undefined" && window.location.origin) {
      url = window.location.origin;
    } else {
      url = "https://tradefourge.vercel.app";
    }
  }

  url = url.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  return url.replace(/\/+$/, "");
}

/**
 * Construct safe redirect URL for Supabase Auth callbacks.
 * Returns ${NEXT_PUBLIC_SITE_URL}/auth/callback
 */
export function getAuthCallbackUrl(targetPath: string = "/auth/callback"): string {
  const baseUrl = getSiteUrl();
  const cleanPath = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  return `${baseUrl}${cleanPath}`;
}
