// lib/account/account-identity.ts
// TradeFourge v3.8.0 — Account Identity & Slug Normalization Utility

/**
 * Generates an internal normalized lookup slug from an account name.
 * Rules:
 * - Trim whitespace
 * - Convert to lowercase
 * - Collapse multiple spaces to single "-"
 * - Strip unsupported special characters (keep alphanumeric and "-")
 * - Strip leading and trailing dashes
 *
 * Examples:
 * - "Cents" -> "cents"
 * - " CENTS " -> "cents"
 * - "My Gold Account" -> "my-gold-account"
 * - "FTMO #1" -> "ftmo-1"
 */
export function generateAccountSlug(name: string): string {
  if (!name) return "";

  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-")        // Replace spaces with -
    .replace(/-+/g, "-")         // Collapse multiple dashes
    .replace(/^-+|-+$/g, "");    // Trim leading/trailing dashes
}

/**
 * Validates slug uniqueness against existing user accounts.
 * Returns true if unique (allowed), false if duplicate.
 */
export function isAccountSlugUnique(
  slug: string,
  existingAccounts: { slug?: string | null; account_name?: string | null; id?: string | null }[],
  currentAccountId?: string | null
): boolean {
  if (!slug) return false;

  return !existingAccounts.some((acc) => {
    if (currentAccountId && acc.id === currentAccountId) return false;
    const accSlug = acc.slug || generateAccountSlug(acc.account_name || "");
    return accSlug === slug;
  });
}
