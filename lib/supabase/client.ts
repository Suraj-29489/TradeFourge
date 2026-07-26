import { createBrowserClient } from "@supabase/ssr";
import { sanitizeSupabaseUrl } from "./config";

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (clientInstance) return clientInstance;

  let supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  let supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || supabaseUrl.includes("placeholder")) {
    supabaseUrl = "https://placeholder.supabase.co";
  }
  if (!supabaseAnonKey || supabaseAnonKey.includes("placeholder")) {
    supabaseAnonKey = "placeholder-anon-key";
  }

  clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return clientInstance;
}
