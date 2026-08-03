// lib/live-sync/conflict-resolver.ts
// TradeFourge v4.0 Conflict Resolution Engine
// Handles trade deduplication, ticket matching, modifications, and archiving.

import type { CloudTrade } from "@/types/database";
import type { LiveTradePayload, ConflictResolutionResult } from "./broker-types";

export class ConflictResolver {
  public static evaluateTradeConflict(
    incoming: LiveTradePayload,
    existingTrades: CloudTrade[]
  ): ConflictResolutionResult {
    // 1. Ticket-based matching
    const match = existingTrades.find((t) => t.ticket === incoming.ticket);

    if (!match) {
      return {
        action: "IMPORT",
        reason: "New trade ticket detected.",
      };
    }

    // 2. Check if existing trade was modified remotely
    const priceChanged =
      (incoming.closePrice !== null && incoming.closePrice !== undefined && match.close_price !== incoming.closePrice) ||
      match.profit !== incoming.profit ||
      match.commission !== incoming.commission ||
      match.swap !== incoming.swap;

    const outcomeChanged =
      incoming.closeTime && match.outcome === "OPEN";

    if (priceChanged || outcomeChanged) {
      return {
        action: "UPDATE",
        reason: "Trade metrics or status modified on broker.",
        existingTradeId: match.id,
      };
    }

    // 3. Trade exists and is unchanged → Skip to prevent duplicates
    return {
      action: "SKIP",
      reason: "Identical ticket already synchronized.",
      existingTradeId: match.id,
    };
  }
}
