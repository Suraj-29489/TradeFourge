// lib/services/MT5ConnectorService.ts
// Server-side Service for MT5 Connector Pairing, Management, Heartbeat, and Revocation.
// Uses Supabase admin client for connector administration.

import { createAdminClient } from "@/lib/supabase/server";
import { generateApiKey, hashApiKey } from "@/lib/api/mt5-auth";
import type { MT5ConnectorRecord } from "@/types/mt5-api";

export class MT5ConnectorService {
  /**
   * Registers a new MT5 connector instance for a user and generates a secure API key.
   * Plaintext API key is returned ONLY ONCE.
   */
  static async registerConnector(
    userId: string,
    connectorName = "Desktop MT5 Terminal"
  ): Promise<{ connector: MT5ConnectorRecord | null; apiKey: string | null; error: string | null }> {
    try {
      const supabase = await createAdminClient();
      const { apiKey, apiKeyHash, apiKeyPrefix } = generateApiKey();

      const { data, error } = await supabase
        .from("mt5_connectors")
        .insert({
          user_id: userId,
          connector_name: connectorName,
          api_key_hash: apiKeyHash,
          api_key_prefix: apiKeyPrefix,
          status: "active",
          version: "1.0.0",
          paired_accounts: 0,
        })
        .select("*")
        .single();

      if (error || !data) {
        return { connector: null, apiKey: null, error: error?.message || "Failed to create connector record" };
      }

      return { connector: data as MT5ConnectorRecord, apiKey, error: null };
    } catch (err: any) {
      return { connector: null, apiKey: null, error: err?.message || "Internal error registering connector" };
    }
  }

  /**
   * Processes a heartbeat ping from an active connector.
   * Updates last_heartbeat timestamp, IP address, software version, and paired accounts.
   */
  static async processHeartbeat(
    connectorId: string,
    version?: string,
    ipAddress?: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const supabase = await createAdminClient();

      // Count active paired accounts for this connector
      const { count } = await supabase
        .from("trading_accounts")
        .select("id", { count: "exact", head: true })
        .eq("connector_id", connectorId)
        .eq("is_active", true);

      const updates: Record<string, any> = {
        last_heartbeat: new Date().toISOString(),
        paired_accounts: count ?? 0,
      };

      if (version) updates.version = version;
      if (ipAddress) updates.last_ip = ipAddress;

      const { error } = await supabase
        .from("mt5_connectors")
        .update(updates)
        .eq("id", connectorId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to process heartbeat" };
    }
  }

  /**
   * Retrieves all MT5 connectors registered for a user (for UI settings display).
   */
  static async getConnectorsForUser(userId: string): Promise<MT5ConnectorRecord[]> {
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("mt5_connectors")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error || !data) return [];
      return data as MT5ConnectorRecord[];
    } catch (err) {
      return [];
    }
  }

  /**
   * Revokes an active MT5 connector.
   * Immediately invalidates its API key and unlinks linked trading accounts.
   */
  static async revokeConnector(
    connectorId: string,
    userId: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const supabase = await createAdminClient();

      const { error } = await supabase
        .from("mt5_connectors")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
        })
        .eq("id", connectorId)
        .eq("user_id", userId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Unlink connected accounts
      await supabase
        .from("trading_accounts")
        .update({ is_mt5_paired: false })
        .eq("connector_id", connectorId);

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to revoke connector" };
    }
  }
}
