/**
 * Admin Feature Flags Store & Service
 * TradeFourge v5.1 — Owner Workspace / Admin Controls
 */

export interface FeatureFlags {
  liveSync: boolean;
  aiCoach: boolean;
  cloudReports: boolean;
  teamWorkspace: boolean;
  experimentalFeatures: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  liveSync: true,
  aiCoach: true,
  cloudReports: true,
  teamWorkspace: true,
  experimentalFeatures: false,
};

const STORAGE_KEY = "tf_admin_feature_flags_v1";

export function getFeatureFlags(): FeatureFlags {
  if (typeof window === "undefined") return DEFAULT_FEATURE_FLAGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FEATURE_FLAGS;
    return { ...DEFAULT_FEATURE_FLAGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FEATURE_FLAGS;
  }
}

export function updateFeatureFlag<K extends keyof FeatureFlags>(
  key: K,
  value: boolean
): FeatureFlags {
  const current = getFeatureFlags();
  const updated = { ...current, [key]: value };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("tf-feature-flags-changed"));
    } catch {}
  }
  return updated;
}

export function isFeatureEnabled(key: keyof FeatureFlags): boolean {
  return getFeatureFlags()[key] ?? false;
}
