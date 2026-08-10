/**
 * TradeFourge Companion Extension v5.1.2 — Safe Internal Event Bus Engine
 * Implements context validity checking, safeEmit wrappers, automatic stale listener
 * unregistration, and silent handling of expected Manifest V3 lifecycle events.
 */

import { isExtensionContextValid, isExpectedLifecycleError } from '../utils/contextCheck.js';
import { Logger } from '../logger/Logger.js';

export class EventBus {
  static instance = null;

  static getInstance() {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  constructor() {
    this.listeners = new Map();
    this.isDisposed = false;
  }

  /**
   * Subscribe to an event with a named or anonymous callback.
   * Returns an explicit cleanup function `() => void`.
   */
  on(eventName, callback) {
    if (this.isDisposed) {
      return () => {};
    }

    if (typeof callback !== 'function') {
      Logger.error('EventBus', `Subscription rejected: callback for '${eventName}' is not a function.`);
      return () => {};
    }

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    const set = this.listeners.get(eventName);
    if (!set.has(callback)) {
      set.add(callback);
    }

    return () => this.off(eventName, callback);
  }

  /**
   * Unsubscribe a callback cleanly.
   */
  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      const set = this.listeners.get(eventName);
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  /**
   * Safe event emission wrapper.
   *
   * Execution flow:
   *   1. Bail if disposed.
   *   2. Check isExtensionContextValid() — if invalid, stop silently.
   *   3. For each callback, execute in isolated try-catch.
   *   4. If callback throws an expected lifecycle error (context invalidated, port closed, etc.),
   *      silently unsubscribe the stale listener — do NOT call Logger.error().
   *   5. Only call Logger.error() for genuinely unexpected, non-lifecycle exceptions.
   */
  safeEmit(eventName, payload = null) {
    if (this.isDisposed) return;

    // Guard: do not emit into a destroyed extension context
    if (!isExtensionContextValid()) {
      return;
    }

    Logger.debug('EventBus', `safeEmit: ${eventName}`);

    // Emit to specific event subscribers
    if (this.listeners.has(eventName)) {
      const callbacks = Array.from(this.listeners.get(eventName));
      callbacks.forEach((callback) => {
        try {
          callback(payload);
        } catch (err) {
          // Always unsubscribe the stale listener first
          this.off(eventName, callback);

          // Only log truly unexpected errors — never log lifecycle disconnect noise
          if (!isExpectedLifecycleError(err)) {
            Logger.error('EventBus', `Callback failed for event '${eventName}'`, { error: err });
          }
        }
      });
    }

    // Emit to wildcard subscribers ('*')
    if (this.listeners.has('*')) {
      const wildcardCallbacks = Array.from(this.listeners.get('*'));
      wildcardCallbacks.forEach((callback) => {
        try {
          callback({ eventName, payload });
        } catch (err) {
          this.off('*', callback);

          if (!isExpectedLifecycleError(err)) {
            Logger.error('EventBus', `Wildcard callback failed for event '${eventName}'`, { error: err });
          }
        }
      });
    }
  }

  /**
   * Alias for backward compatibility.
   */
  emit(eventName, payload = null) {
    this.safeEmit(eventName, payload);
  }

  /**
   * Dispose EventBus and unregister all listeners cleanly.
   */
  dispose() {
    this.listeners.clear();
    this.isDisposed = true;
  }

  reset() {
    this.listeners.clear();
    this.isDisposed = false;
  }
}
