/**
 * TradeFourge Companion Extension v3.0 — Internal Event Bus Engine
 * Decoupled event engine for extension subsystems.
 */

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
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);

    return () => this.off(eventName, callback);
  }

  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).delete(callback);
    }
  }

  emit(eventName, payload = null) {
    Logger.debug('EventBus', `Emitting internal event: ${eventName}`, payload);

    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach((callback) => {
        try {
          callback(payload);
        } catch (err) {
          Logger.error('EventBus', `Error executing callback for event ${eventName}`, err);
        }
      });
    }

    // Broadcast wildcard subscribers
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach((callback) => {
        try {
          callback({ eventName, payload });
        } catch (err) {
          Logger.error('EventBus', `Error executing wildcard callback for event ${eventName}`, err);
        }
      });
    }
  }
}
