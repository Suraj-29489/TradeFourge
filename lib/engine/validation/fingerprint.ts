// lib/engine/validation/fingerprint.ts
// TradeFourge v3.7.3 — CSV Import Engine 2.0: Deterministic Trade Fingerprint & Multi-Level Duplicate Engine

import type { NormalizedTrade } from "../types";
import type { CloudTrade, NewCloudTrade } from "@/types/database";

export interface TradeFingerprintInput {
  ticket?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  symbol: string;
  side: string;
  volume: number;
  accountId?: string | null;
}

/**
 * Creates a canonical, deterministic hash fingerprint for any trade.
 * Fingerprint fields: Ticket, Open Time, Close Time, Symbol, Side, Volume, Account ID.
 */
export function generateTradeFingerprint(trade: TradeFingerprintInput): string {
  const acc = (trade.accountId || "ACC_ANY").trim();
  const ticket = (trade.ticket || "NO_TICKET").trim();
  const symbol = (trade.symbol || "").trim().toUpperCase();
  const side = (trade.side || "").trim().toUpperCase();
  const volume = Number(trade.volume || 0).toFixed(4);

  let openIso = "NO_OPEN_TIME";
  if (trade.openTime) {
    try {
      const d = new Date(trade.openTime);
      if (!isNaN(d.getTime())) openIso = d.toISOString();
    } catch {}
  }

  let closeIso = "NO_CLOSE_TIME";
  if (trade.closeTime) {
    try {
      const d = new Date(trade.closeTime);
      if (!isNaN(d.getTime())) closeIso = d.toISOString();
    } catch {}
  }

  return `${acc}__TKT:${ticket}__SYM:${symbol}__SIDE:${side}__VOL:${volume}__OPEN:${openIso}__CLOSE:${closeIso}`;
}

export interface DuplicateAnalysisResult {
  totalCandidates: number;
  inFileDuplicatesCount: number;
  uniqueCandidateCount: number;
  fingerprints: string[];
}

/**
 * Analyzes in-file duplicate trades across uploaded CSV rows using deterministic fingerprints.
 */
export function analyzeInFileDuplicates(
  trades: NormalizedTrade[],
  accountId: string = "ACC_DEFAULT"
): DuplicateAnalysisResult {
  const fingerprintsSeen = new Set<string>();
  let inFileDuplicatesCount = 0;
  const fingerprints: string[] = [];

  trades.forEach((t) => {
    const fp = generateTradeFingerprint({
      ticket: t.ticket,
      openTime: t.openTime,
      closeTime: t.closeTime,
      symbol: t.symbol,
      side: t.direction,
      volume: t.volume,
      accountId,
    });

    fingerprints.push(fp);

    if (fingerprintsSeen.has(fp)) {
      inFileDuplicatesCount++;
    } else {
      fingerprintsSeen.add(fp);
    }
  });

  return {
    totalCandidates: trades.length,
    inFileDuplicatesCount,
    uniqueCandidateCount: fingerprintsSeen.size,
    fingerprints,
  };
}
