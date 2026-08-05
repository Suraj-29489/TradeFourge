/**
 * TradeFourge v5.1 — Hybrid Architecture Configuration
 * Backend services are re-enabled for Auth, User Profiles, Billing, Subscriptions, Owner Workspace, Teams, and Live Sync.
 * CSV Trade storage remains 100% offline and local (Browser Storage).
 */

export function isFrontendOnly(): boolean {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.NEXT_PUBLIC_FORCE_FRONTEND_ONLY === "true") {
      return true;
    }
  }
  // Backend re-enabled by default for Auth, Profiles, Billing, Admin Workspace
  return false;
}

/**
 * CSV Trade storage is permanently local in browser storage (IndexedDB/sessionStorage/localStorage).
 * CSV trades must NEVER be uploaded to Supabase trade tables under any plan or auth state.
 */
export function isCsvStorageLocal(): boolean {
  return true;
}
