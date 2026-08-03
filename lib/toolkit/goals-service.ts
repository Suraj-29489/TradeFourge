// lib/toolkit/goals-service.ts
// TradeFourge v4.2 Goals & Discipline Tracking Service
// Computes real-time progress for user goals against live journal analytics metrics.

import type { TraderGoal, GoalCategory } from "@/types/database";
import { calculateCloudAnalytics, CompleteAnalyticsSummary } from "@/lib/engine/cloud-analytics-engine";
import type { CloudTradeWithRelations } from "@/types/database";

function getGoalsStorageKey(userId: string): string {
  return `tf_goals_${userId || "default_user"}`;
}

export function fetchGoals(userId: string): TraderGoal[] {
  if (typeof window === "undefined") return DEFAULT_STARTER_GOALS;
  try {
    const raw = localStorage.getItem(getGoalsStorageKey(userId));
    if (!raw) return DEFAULT_STARTER_GOALS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_STARTER_GOALS;
  } catch {
    return DEFAULT_STARTER_GOALS;
  }
}

export function saveGoal(
  userId: string,
  goal: Omit<TraderGoal, "id" | "user_id" | "created_at" | "updated_at"> & { id?: string }
): TraderGoal {
  const existing = fetchGoals(userId);
  const now = new Date().toISOString();

  let updatedGoal: TraderGoal;
  if (goal.id) {
    updatedGoal = {
      ...goal,
      id: goal.id,
      user_id: userId,
      created_at: existing.find((g) => g.id === goal.id)?.created_at || now,
      updated_at: now,
    };
  } else {
    updatedGoal = {
      ...goal,
      id: `GOAL-${Date.now()}`,
      user_id: userId,
      created_at: now,
      updated_at: now,
    };
  }

  const filtered = existing.filter((g) => g.id !== updatedGoal.id);
  const updatedList = [updatedGoal, ...filtered];

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getGoalsStorageKey(userId), JSON.stringify(updatedList));
    } catch (err) {
      console.error("[GoalsService] Failed to save goal:", err);
    }
  }

  return updatedGoal;
}

export function deleteGoal(userId: string, id: string): void {
  if (typeof window === "undefined") return;
  const existing = fetchGoals(userId);
  const updated = existing.filter((g) => g.id !== id);
  try {
    localStorage.setItem(getGoalsStorageKey(userId), JSON.stringify(updated));
  } catch (err) {
    console.error("[GoalsService] Failed to delete goal:", err);
  }
}

export function recalculateGoalsProgress(goals: TraderGoal[], trades: CloudTradeWithRelations[]): TraderGoal[] {
  const analytics = calculateCloudAnalytics(trades);

  return goals.map((goal) => {
    let currentVal = goal.current_value;

    if (goal.category === "win_rate") {
      currentVal = analytics.winRate;
    } else if (goal.category === "profit_target") {
      currentVal = analytics.netProfit;
    } else if (goal.category === "target_rr") {
      currentVal = analytics.avgRR || 0;
    } else if (goal.category === "trade_count") {
      currentVal = analytics.totalTrades;
    }

    const isAchieved = currentVal >= goal.target_value;

    return {
      ...goal,
      current_value: currentVal,
      status: isAchieved ? "achieved" : "active",
    };
  });
}

export const DEFAULT_STARTER_GOALS: TraderGoal[] = [
  {
    id: "GOAL-WINRATE",
    user_id: "starter",
    title: "Maintain 60%+ Win Rate",
    category: "win_rate",
    target_value: 60,
    current_value: 0,
    unit: "%",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "GOAL-PROFIT",
    user_id: "starter",
    title: "Reach $5,000 Monthly Net Profit",
    category: "profit_target",
    target_value: 5000,
    current_value: 0,
    unit: "$",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "GOAL-RR",
    user_id: "starter",
    title: "Achieve Average 2.0 R:R per Trade",
    category: "target_rr",
    target_value: 2.0,
    current_value: 0,
    unit: "R",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
