// lib/toolkit/playbook-service.ts
// TradeFourge v4.2 Playbook & Strategy Service
// Manages creation, retrieval, updating, and deletion of trading playbooks.

import type { PlaybookItem } from "@/types/database";

function getStorageKey(userId: string): string {
  return `tf_playbooks_${userId || "default_user"}`;
}

export function fetchPlaybooks(userId: string): PlaybookItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return DEFAULT_STARTER_PLAYBOOKS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_STARTER_PLAYBOOKS;
  } catch {
    return DEFAULT_STARTER_PLAYBOOKS;
  }
}

export function savePlaybook(
  userId: string,
  item: Omit<PlaybookItem, "id" | "user_id" | "created_at" | "updated_at"> & { id?: string }
): PlaybookItem {
  const existing = fetchPlaybooks(userId);
  const now = new Date().toISOString();

  let updatedItem: PlaybookItem;
  if (item.id) {
    updatedItem = {
      ...item,
      id: item.id,
      user_id: userId,
      created_at: existing.find((p) => p.id === item.id)?.created_at || now,
      updated_at: now,
    };
  } else {
    updatedItem = {
      ...item,
      id: `PB-${Date.now()}`,
      user_id: userId,
      created_at: now,
      updated_at: now,
    };
  }

  const filtered = existing.filter((p) => p.id !== updatedItem.id);
  const updatedList = [updatedItem, ...filtered];

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getStorageKey(userId), JSON.stringify(updatedList));
    } catch (err) {
      console.error("[PlaybookService] Failed to save playbook:", err);
    }
  }

  return updatedItem;
}

export function deletePlaybook(userId: string, id: string): void {
  if (typeof window === "undefined") return;
  const existing = fetchPlaybooks(userId);
  const updated = existing.filter((p) => p.id !== id);
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(updated));
  } catch (err) {
    console.error("[PlaybookService] Failed to delete playbook:", err);
  }
}

export const DEFAULT_STARTER_PLAYBOOKS: PlaybookItem[] = [
  {
    id: "PB-ICT-SILVER-BULLET",
    user_id: "starter",
    strategy_name: "ICT Silver Bullet Model",
    market: "Forex / Indices (EURUSD, NQ)",
    timeframe: "M1 / M5 (H1 Context)",
    entry_rules: [
      "Wait for 10:00 AM NY Session Killzone liquidity sweep",
      "Identify 1m Market Structure Shift (MSS)",
      "Enter on Fair Value Gap (FVG) retracement",
    ],
    exit_rules: [
      "Target opposing Session High / Low",
      "Partial profit at 1:2 R:R",
      "Stop Loss above / below Displacement High",
    ],
    risk_rules: ["Max 1% risk per trade", "Never trade during CPI / NFP news release"],
    checklist: [
      "H1 Trend Direction confirmed",
      "Liquidity sweep executed",
      "FVG clearly visible on M1",
      "Risk:Reward >= 2.0",
    ],
    notes: "High probability setup during NY AM session (10:00 - 11:00 AM EST).",
    win_rate: 68.5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "PB-LONDON-BREAKOUT",
    user_id: "starter",
    strategy_name: "London Session Asian Range Breakout",
    market: "Forex (GBPUSD, EURUSD)",
    timeframe: "M15 / H1",
    entry_rules: [
      "Draw Asian Range High and Low between 00:00 - 06:00 GMT",
      "Wait for fakeout sweep of Asian Range boundary at London Open (07:00 GMT)",
      "Enter reversal upon engulfing candle closing inside range",
    ],
    exit_rules: [
      "Target opposite Asian Range boundary",
      "Stop Loss 5 pips beyond swing high/low",
    ],
    risk_rules: ["0.5% - 1% risk allocation", "Close position before NY Open if stagnant"],
    checklist: [
      "Asian Range width < 30 pips",
      "Sweep candle high volume",
      "Clean R:R to target",
    ],
    notes: "Works best on GBPUSD when Asian range is tight and consolidated.",
    win_rate: 62.0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
