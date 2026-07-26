/**
 * Utility to resolve the application's base URL for Supabase Auth redirects.
 * Guarantees zero trailing slashes and zero double slashes in constructed path URLs.
 */
export function getSiteUrl(): string {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    (typeof window !== "undefined" && window.location.origin ? window.location.origin : "http://localhost:3000");

  // Ensure url includes http/https protocol
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  // Remove trailing slashes
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
