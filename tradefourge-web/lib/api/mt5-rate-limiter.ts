// lib/api/mt5-rate-limiter.ts
// In-Memory Sliding-Window Rate Limiter for MT5 Connector API Endpoints.

interface RateLimitWindow {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitWindow>();

// Cleanup stale rate limit entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, window] of rateLimitStore.entries()) {
      window.timestamps = window.timestamps.filter((ts) => now - ts < 600000); // 10 min retention
      if (window.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 300000);
}

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * Checks and records rate limit for a given identifier (e.g. connectorId or IP address + route).
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { maxRequests: 60, windowMs: 60000 }
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  let record = rateLimitStore.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(identifier, record);
  }

  // Filter timestamps within current window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= options.maxRequests) {
    const oldest = record.timestamps[0];
    const resetMs = oldest + options.windowMs - now;
    return {
      allowed: false,
      limit: options.maxRequests,
      remaining: 0,
      resetMs: Math.max(resetMs, 0),
    };
  }

  record.timestamps.push(now);
  const remaining = options.maxRequests - record.timestamps.length;

  return {
    allowed: true,
    limit: options.maxRequests,
    remaining,
    resetMs: options.windowMs,
  };
}
