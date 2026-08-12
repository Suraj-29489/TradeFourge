import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sanitizeSupabaseUrl } from "./config";

export async function createClient() {
  const cookieStore = await cookies();

  let supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  let supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || supabaseUrl.includes("placeholder")) {
    supabaseUrl = "https://placeholder.supabase.co";
  }
  if (!supabaseAnonKey || supabaseAnonKey.includes("placeholder")) {
    supabaseAnonKey = "placeholder-anon-key";
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server component setAll call
        }
      },
    },
  });
}

/**
 * Server-side Admin Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 * Use strictly for server-side administrative background tasks, migrations, and service role queries.
 */
export async function createAdminClient() {
  let cookieStore: any = null;
  try {
    cookieStore = await cookies();
  } catch {
    // Called outside Next.js request context (e.g. background task, CLI script)
  }

  let supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  let serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || supabaseUrl.includes("placeholder")) {
    supabaseUrl = "https://placeholder.supabase.co";
  }
  if (!serviceRoleKey || serviceRoleKey.includes("placeholder")) {
    serviceRoleKey = "placeholder-key";
  }

  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll() {
        return cookieStore ? cookieStore.getAll() : [];
      },
      setAll(cookiesToSet) {
        if (!cookieStore) return;
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server component setAll call
        }
      },
    },
  });
}
