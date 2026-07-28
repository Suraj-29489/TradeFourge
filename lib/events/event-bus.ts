"use client";
// lib/events/event-bus.ts
// Centralized typed domain event bus for TradeFourge v3.2.7.
// Enables instant, targeted UI updates across all components without full page reloads.

import { useEffect } from "react";

export type AppEventType =
  | "tradefourge:trade-created"
  | "tradefourge:trade-updated"
  | "tradefourge:trade-deleted"
  | "tradefourge:import-created"
  | "tradefourge:import-deleted"
  | "tradefourge:account-created"
  | "tradefourge:account-updated"
  | "tradefourge:account-deleted";

/**
 * Dispatch a typed application domain event across the browser window.
 */
export function emitAppEvent(type: AppEventType, detail?: Record<string, any>): void {
  if (typeof window === "undefined") return;
  const event = new CustomEvent(type, { detail });
  window.dispatchEvent(event);
}

/**
 * React hook to listen for one or more typed domain events.
 */
export function useAppEventListener(
  types: AppEventType | AppEventType[],
  callback: (type: AppEventType, detail?: any) => void
): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const typeList = Array.isArray(types) ? types : [types];

    const handler = (e: Event) => {
      const custom = e as CustomEvent;
      callback(custom.type as AppEventType, custom.detail);
    };

    typeList.forEach((t) => window.addEventListener(t, handler));
    return () => {
      typeList.forEach((t) => window.removeEventListener(t, handler));
    };
  }, [types, callback]);
}
