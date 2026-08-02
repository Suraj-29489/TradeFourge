/**
 * Configuration helper for Frontend Development Mode (Backend Isolation).
 * When enabled via NEXT_PUBLIC_FRONTEND_ONLY=true or NEXT_PUBLIC_DISABLE_BACKEND=true,
 * all database reads, writes, RPCs, and storage uploads are intercepted and served in-memory/sessionStorage.
 */
export function isFrontendOnly(): boolean {
  if (typeof process !== "undefined" && process.env) {
    if (
      process.env.NEXT_PUBLIC_FRONTEND_ONLY === "true" ||
      process.env.NEXT_PUBLIC_DISABLE_BACKEND === "true"
    ) {
      return true;
    }
  }
  return false;
}
