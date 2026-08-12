// lib/api/mt5-auth.ts
// API Key Authentication & Validation for MT5 Connector REST endpoints.

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import type { MT5ConnectorRecord } from "@/types/mt5-api";

export interface AuthenticatedConnector {
  connectorId: string;
  userId: string;
  connectorName: string;
  status: "active" | "revoked" | "expired";
  version: string | null;
}

/**
 * Computes a SHA-256 hash of a raw API key string.
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey.trim()).digest("hex");
}

/**
 * Generates a new secure random API key with standard prefix.
 * Example format: "tf_mt5_a1b2c3d4e5f67890..."
 */
export function generateApiKey(): { apiKey: string; apiKeyHash: string; apiKeyPrefix: string } {
  const randomBuffer = crypto.randomBytes(24).toString("hex");
  const apiKey = `tf_mt5_${randomBuffer}`;
  const apiKeyHash = hashApiKey(apiKey);
  const apiKeyPrefix = apiKey.substring(0, 14); // e.g. "tf_mt5_a1b2c3d4"
  return { apiKey, apiKeyHash, apiKeyPrefix };
}

/**
 * Validates the Authorization header from an incoming HTTP request.
 * Expected header: "Authorization: Bearer tf_mt5_..."
 */
export async function validateConnectorAuth(
  request: Request
): Promise<{ connector: AuthenticatedConnector | null; error: string | null; status: number }> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      connector: null,
      error: "Missing or invalid Authorization header. Expected Bearer token.",
      status: 401,
    };
  }

  const rawKey = authHeader.replace("Bearer ", "").trim();
  if (!rawKey.startsWith("tf_mt5_")) {
    return {
      connector: null,
      error: "Invalid API key format.",
      status: 401,
    };
  }

  const keyHash = hashApiKey(rawKey);

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("mt5_connectors")
      .select("id, user_id, connector_name, status, version")
      .eq("api_key_hash", keyHash)
      .single();

    if (error || !data) {
      return {
        connector: null,
        error: "Connector not found or invalid API key.",
        status: 401,
      };
    }

    const rec = data as Pick<MT5ConnectorRecord, "id" | "user_id" | "connector_name" | "status" | "version">;

    if (rec.status === "revoked") {
      return {
        connector: null,
        error: "This connector registration has been revoked.",
        status: 403,
      };
    }

    if (rec.status === "expired") {
      return {
        connector: null,
        error: "This connector registration has expired.",
        status: 403,
      };
    }

    return {
      connector: {
        connectorId: rec.id,
        userId: rec.user_id,
        connectorName: rec.connector_name,
        status: rec.status,
        version: rec.version,
      },
      error: null,
      status: 200,
    };
  } catch (err: any) {
    return {
      connector: null,
      error: `Authentication lookup failed: ${err?.message || "Unknown error"}`,
      status: 500,
    };
  }
}
