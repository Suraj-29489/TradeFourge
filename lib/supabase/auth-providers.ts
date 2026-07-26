import { createClient } from "./client";
import { getAuthCallbackUrl } from "./config";
import { type Provider } from "@supabase/supabase-js";

export type SupportedAuthProvider = "google" | "github" | "discord" | "apple" | "azure" | "phone";

export interface AuthProviderConfig {
  id: SupportedAuthProvider;
  name: string;
  enabled: boolean;
  type: "oauth" | "phone";
  iconName: string;
  description: string;
}

export const AUTH_PROVIDERS_REGISTRY: AuthProviderConfig[] = [
  {
    id: "google",
    name: "Google",
    enabled: true,
    type: "oauth",
    iconName: "google",
    description: "Instant single sign-on using your Google workspace account.",
  },
  {
    id: "github",
    name: "GitHub",
    enabled: true,
    type: "oauth",
    iconName: "github",
    description: "Authenticate using your GitHub developer profile.",
  },
  {
    id: "discord",
    name: "Discord",
    enabled: true,
    type: "oauth",
    iconName: "discord",
    description: "Sign in with your Discord community trader identity.",
  },
  {
    id: "apple",
    name: "Apple",
    enabled: false, // Architecture ready for future enable
    type: "oauth",
    iconName: "apple",
    description: "Secure Apple ID authentication with private email relay.",
  },
  {
    id: "azure",
    name: "Microsoft",
    enabled: false, // Architecture ready for future enable
    type: "oauth",
    iconName: "microsoft",
    description: "Enterprise Microsoft 365 single sign-on.",
  },
  {
    id: "phone",
    name: "Phone SMS OTP",
    enabled: false, // Architecture ready for future enable
    type: "phone",
    iconName: "phone",
    description: "Passwordless SMS OTP code verification.",
  },
];

/**
 * Modular Provider-Agnostic OAuth Sign-In Handler
 */
export async function signInWithProvider(provider: SupportedAuthProvider) {
  const supabase = createClient();
  const callbackUrl = getAuthCallbackUrl("/auth/callback");

  if (provider === "phone") {
    throw new Error("Phone SMS OTP authentication is prepared for future release.");
  }

  // Map to Supabase provider string
  const supabaseProvider: Provider = provider === "azure" ? "azure" : (provider as Provider);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: supabaseProvider,
    options: {
      redirectTo: callbackUrl,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}
