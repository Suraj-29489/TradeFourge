/**
 * TradeFourge Companion Extension v5.1.2 — Bridge Dispatcher
 * Runs in broker tab content script.
 * Manages background worker communication, named EventBus handlers,
 * double-initialization guards, and idempotent destroyTradeForgeContext cleanup.
 *
 * Lifecycle state machine:
 *   NOT_INITIALIZED → INITIALIZING → CONNECTED
 *                                   ↓
 *                             destroyTradeForgeContext()
 *                                   ↓
 *                             NOT_INITIALIZED  (ready for clean reinjection)
 */

import { TF_SOURCE_WEB, createMessageEnvelope } from '../types/protocol.js';
import { DiscoveryEngine } from '../engines/DiscoveryEngine.js';
import { HistoryImportEngine } from '../engines/HistoryImportEngine.js';
import { LiveRuntimeMonitor } from '../engines/LiveRuntimeMonitor.js';
import { HeartbeatSystem } from '../heartbeat/HeartbeatSystem.js';
import { EventBus } from '../eventBus/EventBus.js';
import { Logger } from '../logger/Logger.js';
import { ConnectionManager } from '../connection/ConnectionManager.js';
import { isExtensionContextValid, isExpectedLifecycleError } from '../utils/contextCheck.js';

const TAG = 'Bridge';
const VERSION = '5.1.2';

export const InitStates = {
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  INITIALIZING: 'INITIALIZING',
  CONNECTED: 'CONNECTED',
};

export class BridgeDispatcher {
  static instance = null;

  static getInstance() {
    if (!BridgeDispatcher.instance) {
      BridgeDispatcher.instance = new BridgeDispatcher();
    }
    return BridgeDispatcher.instance;
  }

  /**
   * Reset the singleton so a fresh injection creates a clean instance.
   * Called during destroyTradeForgeContext so the next content-script run starts fresh.
   */
  static resetInstance() {
    BridgeDispatcher.instance = null;
  }

  constructor() {
    this.initState = InitStates.NOT_INITIALIZED;
    this.connectionManager = ConnectionManager.getInstance();
    this.unsubscribers = [];
    this.boundHandlers = {};
  }

  init() {
    // Prevent duplicate initialization
    if (this.initState !== InitStates.NOT_INITIALIZED) {
      Logger.debug(TAG, `Initialization suppressed: already in state ${this.initState}`);
      return;
    }
    this.initState = InitStates.INITIALIZING;

    Logger.success(TAG, `Initializing Bridge Dispatcher v${VERSION}...`);

    // Connect runtime port safely
    this.connectionManager.connect();

    // Start runtime engines
    try {
      HeartbeatSystem.getInstance().start();
      LiveRuntimeMonitor.getInstance().start();
    } catch (err) {
      if (!isExpectedLifecycleError(err)) {
        Logger.debug(TAG, 'Engine initialization error:', { error: err });
      }
    }

    // ── Named handlers for EventBus subscriptions ──
    this.boundHandlers.onHistoryImported = (payload) => {
      if (!isExtensionContextValid()) return;
      this.sendToBackground('IMPORT_COMPLETED', payload);
    };

    this.boundHandlers.onHeartbeat = (payload) => {
      if (!isExtensionContextValid()) return;
      this.sendToBackground('PONG', payload);
    };

    this.boundHandlers.onLiveEvent = (eventType) => (payload) => {
      if (!isExtensionContextValid()) return;
      this.sendToBackground(eventType, payload);
    };

    // ── Register subscriptions and save unsubscribe handles ──
    const unsubImport = EventBus.getInstance().on('HistoryImported', this.boundHandlers.onHistoryImported);
    this.unsubscribers.push(unsubImport);

    const unsubHeartbeat = EventBus.getInstance().on('Heartbeat', this.boundHandlers.onHeartbeat);
    this.unsubscribers.push(unsubHeartbeat);

    const liveEvents = [
      'LIVE_EVENT',
      'ACCOUNT_UPDATED',
      'BALANCE_UPDATED',
      'EQUITY_UPDATED',
      'POSITION_OPENED',
      'POSITION_MODIFIED',
      'POSITION_CLOSED',
    ];
    liveEvents.forEach((eventType) => {
      const handler = this.boundHandlers.onLiveEvent(eventType);
      const unsub = EventBus.getInstance().on(eventType, handler);
      this.unsubscribers.push(unsub);
    });

    // ── chrome.runtime.onMessage listener ──
    if (isExtensionContextValid() && chrome.runtime.onMessage) {
      const onMessageHandler = (message, sender, sendResponse) => {
        if (!isExtensionContextValid()) return false;
        const type = message?.type || 'UNKNOWN';
        const requestId = message?.requestId || 'none';

        Logger.debug(TAG, `Received from Background: ${type} (${requestId})`);
        this.handleMessage(message, sendResponse);
        return true;
      };

      try {
        chrome.runtime.onMessage.addListener(onMessageHandler);
      } catch (err) {}

      this.unsubscribers.push(() => {
        try {
          if (isExtensionContextValid()) {
            chrome.runtime.onMessage.removeListener(onMessageHandler);
          }
        } catch (err) {}
      });
    }

    // ── window.postMessage listener + page lifecycle teardown ──
    // NOTE: Do NOT use 'unload' or 'beforeunload' — Exness pages set
    // Permissions-Policy: unload=(), which makes those events throw.
    // Use 'pagehide' (fires on navigation/tab close) and
    // 'visibilitychange' (fires when tab goes hidden) instead.
    if (typeof window !== 'undefined') {
      const windowPostMessageHandler = (event) => {
        if (!event.data || typeof event.data !== 'object') return;
        const data = event.data;
        if (data.source !== TF_SOURCE_WEB) return;

        Logger.debug(TAG, `Received via window.postMessage: ${data.type}`);
        this.handleMessage(data, null);
      };
      window.addEventListener('message', windowPostMessageHandler);
      this.unsubscribers.push(() => window.removeEventListener('message', windowPostMessageHandler));

      const lifecycleTeardown = () => {
        this.destroyTradeForgeContext();
      };

      // pagehide fires on page navigation, tab close, and bfcache entry
      window.addEventListener('pagehide', lifecycleTeardown);
      this.unsubscribers.push(() => {
        window.removeEventListener('pagehide', lifecycleTeardown);
      });
    }

    this.initState = InitStates.CONNECTED;
  }

  async handleMessage(message, sendResponse) {
    if (!isExtensionContextValid()) return;

    const { type, requestId, payload } = message;
    Logger.debug(TAG, `Processing: ${type} (${requestId})`);

    switch (type) {
      case 'PING':
      case 'GET_EXTENSION_INFO': {
        const response = this.createResponse(
          'PONG',
          {
            isInstalled: true,
            version: VERSION,
            browser: 'Chrome',
            status: 'connected',
            state: this.connectionManager.getState(),
            latency: 0,
          },
          requestId
        );

        if (sendResponse) {
          sendResponse(response);
        } else {
          this.sendToBackground('PONG', response.payload, requestId);
        }
        break;
      }

      case 'DISCOVER_ACCOUNTS': {
        try {
          const accounts = await DiscoveryEngine.getInstance().discoverAccounts();
          const response = this.createResponse('ACCOUNT_LIST', accounts, requestId);
          if (sendResponse) {
            sendResponse(response);
          } else {
            this.sendToBackground('ACCOUNT_LIST', accounts, requestId);
          }
        } catch (err) {
          if (!isExpectedLifecycleError(err)) {
            Logger.debug(TAG, 'Discovery error:', { error: err });
          }
          const response = this.createResponse('ERROR', null, requestId, {
            code: 'NO_ACCOUNTS_FOUND',
            message: 'Unable to discover Exness trading accounts.',
            stage: 'DISCOVERING',
            reason: String(err),
            suggestedAction: 'Ensure Exness terminal is open and logged in.',
          });
          if (sendResponse) {
            sendResponse(response);
          } else {
            this.sendToBackground('ERROR', null, requestId, response.error);
          }
        }
        break;
      }

      case 'IMPORT_SELECTED_ACCOUNTS': {
        const accountIds = payload?.accountIds || [];
        const startedResponse = this.createResponse(
          'IMPORT_STARTED',
          { stage: 'connecting', fetchedTrades: 0, totalTrades: 0, percentage: 0 },
          requestId
        );

        if (sendResponse) {
          sendResponse(startedResponse);
        } else {
          this.sendToBackground('IMPORT_STARTED', startedResponse.payload, requestId);
        }

        HistoryImportEngine.getInstance().importSelectedAccounts(
          accountIds,
          (progress) => {
            this.sendToBackground('IMPORT_PROGRESS', progress, requestId);
          },
          (completed) => {
            this.sendToBackground('IMPORT_COMPLETED', completed, requestId);
          },
          requestId
        );
        break;
      }

      case 'HEARTBEAT': {
        const response = this.createResponse('PONG', { status: 'alive', state: this.connectionManager.getState() }, requestId);
        if (sendResponse) {
          sendResponse(response);
        } else {
          this.sendToBackground('PONG', response.payload, requestId);
        }
        break;
      }

      default:
        break;
    }
  }

  createResponse(type, payload = null, requestId = null, error = null) {
    return createMessageEnvelope(type, payload, requestId, error);
  }

  sendToBackground(type, payload = null, requestId = null, error = null) {
    if (!isExtensionContextValid()) return;

    const envelope = createMessageEnvelope(type, payload, requestId, error);
    envelope.isPushEvent = true;

    this.connectionManager.sendMessage(envelope).catch((err) => {
      if (!isExpectedLifecycleError(err)) {
        Logger.debug(TAG, `sendToBackground error for ${type}:`, { error: err });
      }
    });
  }

  /**
   * Single, idempotent context cleanup routine.
   * Safe to invoke multiple times without throwing exceptions.
   * Resets singleton instances so the next content-script injection starts fresh.
   */
  destroyTradeForgeContext() {
    if (this.initState === InitStates.NOT_INITIALIZED) return;

    Logger.debug(TAG, 'destroyTradeForgeContext: tearing down all subscriptions and timers...');

    // 1. Stop Heartbeat timer (idempotent)
    try {
      HeartbeatSystem.getInstance().stopHeartbeat();
    } catch (err) {}

    // 2. Stop LiveRuntimeMonitor / ExnessAdapter live timer (idempotent)
    try {
      LiveRuntimeMonitor.getInstance().stop();
    } catch (err) {}

    // 3. Unsubscribe all EventBus listeners
    this.unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch (err) {}
    });
    this.unsubscribers = [];

    // 4. Disconnect runtime connection port
    try {
      this.connectionManager.disconnect();
    } catch (err) {}

    // 5. Reset init state
    this.initState = InitStates.NOT_INITIALIZED;

    // 6. Reset EventBus singleton so reinjected script starts with clean listeners
    try {
      EventBus.getInstance().reset();
      EventBus.instance = null;
    } catch (err) {}

    // 7. Reset HeartbeatSystem singleton
    try {
      HeartbeatSystem.instance = null;
    } catch (err) {}

    // 8. Reset LiveRuntimeMonitor singleton
    try {
      LiveRuntimeMonitor.instance = null;
    } catch (err) {}

    // 9. Remove injection guard from DOM so reinjection is allowed
    try {
      delete document.documentElement.dataset.tradefourgeV5Injected;
    } catch (err) {}

    // 10. Reset BridgeDispatcher singleton last
    BridgeDispatcher.resetInstance();

    Logger.debug(TAG, 'destroyTradeForgeContext: complete.');
  }

  dispose() {
    this.destroyTradeForgeContext();
  }
}
