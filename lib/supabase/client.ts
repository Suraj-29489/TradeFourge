import { createBrowserClient } from "@supabase/ssr";

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (clientInstance) return clientInstance;

  let supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  let supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  // Handle missing or placeholder credentials safely
  if (!supabaseUrl || supabaseUrl.includes("placeholder")) {
    supabaseUrl = "https://placeholder.supabase.co";
  }
  if (!supabaseAnonKey || supabaseAnonKey.includes("placeholder")) {
    supabaseAnonKey = "placeholder-anon-key";
  }

  clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return clientInstance;
}
