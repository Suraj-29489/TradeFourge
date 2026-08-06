/**
 * TradeFourge v5.5.0 — Permanent Cloud Architecture
 * All trade records, CSV imports, journal entries, and account statistics are stored permanently in Supabase.
 * Browser storage (sessionStorage/localStorage) is strictly forbidden for trade history persistence.
 */

export function isFrontendOnly(): boolean {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.NEXT_PUBLIC_FORCE_FRONTEND_ONLY === "true") {
      return true;
    }
  }
  return false;
}

/**
 * CSV Trade storage is 100% cloud-persisted in Supabase PostgreSQL tables.
 * Returns false so all trade imports and queries hit Supabase with RLS user isolation.
 */
export function isCsvStorageLocal(): boolean {
  return false;
}
