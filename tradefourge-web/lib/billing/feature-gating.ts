// lib/billing/feature-gating.ts
// TradeFourge v5.0 Plan Tier Feature Gating Engine

export type SubscriptionPlanId = "free" | "pro" | "team";

export interface PlanLimits {
  id: SubscriptionPlanId;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxAccounts: number; // -1 for unlimited
  hasLiveSync: boolean;
  hasPdfReports: boolean;
  hasTraderToolkit: boolean;
  maxTeamMembers: number;
  hasPrioritySupport: boolean;
}

export const PLAN_TIERS: Record<SubscriptionPlanId, PlanLimits> = {
  free: {
    id: "free",
    name: "Starter Free",
    priceMonthly: 0,
    priceYearly: 0,
    maxAccounts: 1,
    hasLiveSync: false,
    hasPdfReports: false,
    hasTraderToolkit: false,
    maxTeamMembers: 1,
    hasPrioritySupport: false,
  },
  pro: {
    id: "pro",
    name: "Pro Trader",
    priceMonthly: 29,
    priceYearly: 24,
    maxAccounts: -1, // Unlimited
    hasLiveSync: true,
    hasPdfReports: true,
    hasTraderToolkit: true,
    maxTeamMembers: 1,
    hasPrioritySupport: true,
  },
  team: {
    id: "team",
    name: "Team & Desk",
    priceMonthly: 79,
    priceYearly: 65,
    maxAccounts: -1, // Unlimited
    hasLiveSync: true,
    hasPdfReports: true,
    hasTraderToolkit: true,
    maxTeamMembers: 10,
    hasPrioritySupport: true,
  },
};

function getSubscriptionStorageKey(userId: string): string {
  return `tf_subscription_${userId || "default_user"}`;
}

export function getUserPlan(userId: string): PlanLimits {
  if (typeof window === "undefined") return PLAN_TIERS.pro; // Default to Pro in dev/server
  try {
    const raw = localStorage.getItem(getSubscriptionStorageKey(userId));
    if (!raw) return PLAN_TIERS.pro;
    const parsed = JSON.parse(raw);
    return PLAN_TIERS[parsed.planId as SubscriptionPlanId] || PLAN_TIERS.pro;
  } catch {
    return PLAN_TIERS.pro;
  }
}

export function canCreateAccount(userId: string, currentAccountCount: number): boolean {
  const plan = getUserPlan(userId);
  if (plan.maxAccounts === -1) return true;
  return currentAccountCount < plan.maxAccounts;
}

export function canAccessLiveSync(userId: string): boolean {
  const plan = getUserPlan(userId);
  return plan.hasLiveSync;
}

export function canAccessPdfReports(userId: string): boolean {
  const plan = getUserPlan(userId);
  return plan.hasPdfReports;
}

export function canAccessToolkit(userId: string): boolean {
  const plan = getUserPlan(userId);
  return plan.hasTraderToolkit;
}
