/**
 * TradeFourge v5.1.1 — Role-Based Authorization & Owner Security Engine
 * Supported Roles: owner | admin | support | user
 */

export type UserRole = "owner" | "admin" | "support" | "user";

export function getOwnerEmail(): string {
  if (typeof process !== "undefined" && process.env) {
    const envEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || process.env.OWNER_EMAIL;
    if (envEmail && envEmail.trim()) {
      return envEmail.trim().toLowerCase();
    }
  }
  return "owner@tradefourge.com";
}

export function isOwnerEmail(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  return email.trim().toLowerCase() === getOwnerEmail();
}

/**
 * Checks if target entity (profile, user, or session metadata) has owner status.
 * Evaluates role === 'owner' or email matching configured owner email.
 */
export function isOwner(
  target?: { role?: string | null; email?: string | null } | null
): boolean {
  if (!target) return false;
  if (target.role === "owner") return true;
  if (target.email && isOwnerEmail(target.email)) return true;
  return false;
}

/**
 * Backwards compatibility alias for components checking user entity
 */
export function isOwnerUser(
  user?: { role?: string | null; email?: string | null } | null
): boolean {
  return isOwner(user);
}

/**
 * Validates whether a user/profile has a specific required role or list of roles.
 * Owner role automatically satisfies all role checks.
 */
export function hasRole(
  target: { role?: string | null; email?: string | null } | null,
  requiredRole: UserRole | UserRole[]
): boolean {
  if (!target) return false;
  if (isOwner(target)) return true;

  const currentRole = target.role || "user";
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(currentRole as UserRole);
  }
  return currentRole === requiredRole;
}

/**
 * Resolves effective profile role with automatic backward compatibility assignment.
 * Assigns 'owner' for designated owner email, else defaults to 'user'.
 */
export function resolveProfileRole(
  target?: { role?: string | null; email?: string | null } | null
): UserRole {
  if (target?.role && ["owner", "admin", "support", "user"].includes(target.role)) {
    return target.role as UserRole;
  }
  if (target?.email && isOwnerEmail(target.email)) {
    return "owner";
  }
  return "user";
}
