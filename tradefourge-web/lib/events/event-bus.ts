"use client";

/**
 * TradeFourge v5.5.3 — Centralized Typed Domain Event Bus
 * Enables instant, targeted UI updates across all components without page reloads.
 * Provides safe event subscription with automatic unregistration.
 */

import { useEffect, useRef } from "react";

export type AppEventType =
  | "tradefourge:trade-created"
  | "tradefourge:trade-updated"
  | "tradefourge:trade-deleted"
  | "tradefourge:import-created"
  | "tradefourge:import-deleted"
  | "tradefourge:account-created"
  | "tradefourge:account-updated"
  | "tradefourge:account-deleted"
  | "tradefourge:equity-updated"
  | "tradefourge:heartbeat"
  | "tradefourge:data-changed";

/**
 * Dispatch a typed application domain event across the browser window.
 */
export function emitAppEvent(type: AppEventType, detail?: Record<string, any>): void {
  if (typeof window === "undefined") return;
  const event = new CustomEvent(type, { detail });
  window.dispatchEvent(event);

  if (type !== "tradefourge:data-changed" && type.startsWith("tradefourge:")) {
    window.dispatchEvent(new CustomEvent("tradefourge:data-changed", { detail }));
  }
}

/**
 * Subscribe to a domain event outside React components.
 * Returns an unsubscribe cleanup function `() => void`.
 */
export function subscribeAppEvent(
  type: AppEventType | AppEventType[],
  callback: (type: AppEventType, detail?: any) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const typeList = Array.isArray(type) ? type : [type];

  const handler = (e: Event) => {
    const custom = e as CustomEvent;
    try {
      callback(custom.type as AppEventType, custom.detail);
    } catch (err) {
      console.error(`[EventBus] Callback error for ${custom.type}:`, err);
    }
  };

  typeList.forEach((t) => window.addEventListener(t, handler));
  return () => {
    typeList.forEach((t) => window.removeEventListener(t, handler));
  };
}

/**
 * React hook to listen for one or more typed domain events.
 * Uses useRef to ensure the callback is always current without re-subscribing.
 */
export function useAppEventListener(
  types: AppEventType | AppEventType[],
  callback: (type: AppEventType, detail?: any) => void
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const typeList = Array.isArray(types) ? types : [types];

    const handler = (e: Event) => {
      const custom = e as CustomEvent;
      callbackRef.current(custom.type as AppEventType, custom.detail);
    };

    typeList.forEach((t) => window.addEventListener(t, handler));
    return () => {
      typeList.forEach((t) => window.removeEventListener(t, handler));
    };
  }, [JSON.stringify(types)]);
}
