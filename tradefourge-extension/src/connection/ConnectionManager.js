/**
 * TradeFourge Companion Extension v5.1.2 — Connection Manager
 * Single runtime port & messaging manager. Handles silent background reconnection,
 * state transition monitoring, outbound message queueing, and replay.
 *
 * scheduleReconnect() stops retrying if context stays invalid for > maxContextRetries
 * consecutive attempts to prevent infinite retry loops during service worker suspension.
 */

import { isExtensionContextValid, isExpectedLifecycleError } from '../utils/contextCheck.js';
import { Logger } from '../logger/Logger.js';
import { OutboundMessageQueue } from '../queue/OutboundMessageQueue.js';

export const ConnectionStates = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  SUSPENDED: 'SUSPENDED',
  RECOVERING: 'RECOVERING',
};

export class ConnectionManager {
  static instance = null;

  static getInstance() {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  constructor() {
    this.currentState = ConnectionStates.DISCONNECTED;
    this.port = null;
    this.reconnectTimer = null;
    this.listeners = new Set();
    this.outboundQueue = OutboundMessageQueue.getInstance();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;
    // Track consecutive context-invalid reconnect checks to bail out gracefully
    this.contextInvalidCount = 0;
    this.maxContextInvalidAttempts = 10;
    this.isDestroyed = false;
  }

  getState() {
    return this.currentState;
  }

  isConnected() {
    return this.currentState === ConnectionStates.CONNECTED && isExtensionContextValid();
  }

  setState(newState, details = {}) {
    if (this.currentState === newState) return;
    const oldState = this.currentState;
    this.currentState = newState;

    Logger.debug('ConnectionManager', `State: ${oldState} ➔ ${newState}`, details);
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentState, oldState, details);
      } catch (err) {}
    });
  }

  onStateChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Connect or reconnect to background worker port cleanly.
   */
  connect() {
    if (this.isDestroyed) return null;

    if (!isExtensionContextValid()) {
      this.setState(ConnectionStates.RECOVERING, { reason: 'Context invalid during connect' });
      this.scheduleReconnect();
      return null;
    }

    if (this.port) {
      try {
        this.port.disconnect();
      } catch (err) {}
      this.port = null;
    }

    this.setState(ConnectionStates.CONNECTING);

    try {
      this.port = chrome.runtime.connect({ name: 'tradefourge-content-port' });
      this.reconnectAttempts = 0;
      this.contextInvalidCount = 0;
      this.setState(ConnectionStates.CONNECTED);

      this.port.onDisconnect.addListener(() => {
        if (this.isDestroyed) return;
        const lastErr = chrome.runtime.lastError;
        this.port = null;
        if (isExpectedLifecycleError(lastErr)) {
          Logger.debug('ConnectionManager', 'Port disconnected (expected MV3 lifecycle event).');
        }
        this.setState(ConnectionStates.RECOVERING, { reason: lastErr?.message || 'Port disconnected' });
        this.scheduleReconnect();
      });

      this.port.onMessage.addListener((msg) => {
        Logger.debug('ConnectionManager', `Port received message: ${msg?.type}`);
      });

      // Replay any pending queued messages
      this.outboundQueue.replay((msg) => this.sendMessageDirect(msg));

      return this.port;
    } catch (err) {
      if (!isExpectedLifecycleError(err)) {
        Logger.debug('ConnectionManager', 'Port connection failed.', { error: err });
      }
      this.setState(ConnectionStates.RECOVERING, { reason: err?.message });
      this.scheduleReconnect();
      return null;
    }
  }

  scheduleReconnect() {
    if (this.isDestroyed) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState(ConnectionStates.SUSPENDED, { reason: 'Max reconnect retries reached' });
      return;
    }

    this.reconnectAttempts += 1;
    const delayMs = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), 15000);

    this.reconnectTimer = setTimeout(() => {
      if (this.isDestroyed) return;

      if (!isExtensionContextValid()) {
        this.contextInvalidCount += 1;
        if (this.contextInvalidCount >= this.maxContextInvalidAttempts) {
          // Context has been invalid for too long — stop retrying to avoid infinite loop
          this.setState(ConnectionStates.SUSPENDED, { reason: 'Context permanently invalid — suspending reconnect' });
          return;
        }
        this.scheduleReconnect();
      } else {
        this.contextInvalidCount = 0;
        this.connect();
      }
    }, delayMs);
  }

  /**
   * Safe message dispatch to background.
   */
  async sendMessage(envelope) {
    if (this.isDestroyed) return false;

    if (!isExtensionContextValid()) {
      this.setState(ConnectionStates.RECOVERING, { reason: 'Context invalid' });
      this.outboundQueue.enqueue(envelope);
      this.scheduleReconnect();
      return false;
    }

    try {
      await this.sendMessageDirect(envelope);
      return true;
    } catch (err) {
      if (isExpectedLifecycleError(err)) {
        Logger.debug('ConnectionManager', `Send failed due to context update: ${envelope.type}`);
      } else {
        Logger.warn('ConnectionManager', `Send error for ${envelope.type}:`, { error: err });
      }

      this.setState(ConnectionStates.RECOVERING, { reason: err?.message });
      this.outboundQueue.enqueue(envelope);
      this.scheduleReconnect();
      return false;
    }
  }

  async sendMessageDirect(envelope) {
    return new Promise((resolve, reject) => {
      if (!isExtensionContextValid()) {
        return reject(new Error('Extension context invalidated'));
      }

      try {
        chrome.runtime.sendMessage(envelope, (response) => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) {
            reject(lastErr);
          } else {
            resolve(response);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect() {
    this.isDestroyed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.port) {
      try {
        this.port.disconnect();
      } catch (err) {}
      this.port = null;
    }
    this.listeners.clear();
    this.setState(ConnectionStates.DISCONNECTED);
  }
}
