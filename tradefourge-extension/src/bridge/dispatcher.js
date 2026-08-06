/**
 * TradeFourge Companion Extension v3.4 — Bridge Dispatcher
 * Runs in the Exness tab content script.
 * Handles messages from the Background Service Worker via chrome.runtime.onMessage
 * and sends messages to background using chrome.runtime.sendMessage.
 */

import { TF_SOURCE_EXTENSION, TF_SOURCE_WEB, createMessageEnvelope } from '../types/protocol.js';
import { DiscoveryEngine } from '../engines/DiscoveryEngine.js';
import { HistoryImportEngine } from '../engines/HistoryImportEngine.js';
import { LiveRuntimeMonitor } from '../engines/LiveRuntimeMonitor.js';
import { HeartbeatSystem } from '../heartbeat/HeartbeatSystem.js';
import { EventBus } from '../eventBus/EventBus.js';
import { Logger } from '../logger/Logger.js';

const TAG = '[TradeFourge ContentScript]';

export class BridgeDispatcher {
  static instance = null;

  static getInstance() {
    if (!BridgeDispatcher.instance) {
      BridgeDispatcher.instance = new BridgeDispatcher();
    }
    return BridgeDispatcher.instance;
  }

  constructor() {
    this.isListening = false;
  }

  init() {
    if (this.isListening) return;
    this.isListening = true;

    Logger.success('BridgeDispatcher', 'Initializing Exness ↔ Extension Bridge Dispatcher v3.4...');

    // Start broker engines
    HeartbeatSystem.getInstance().start();
    LiveRuntimeMonitor.getInstance().start();

    // Listen for EventBus emissions
    EventBus.getInstance().on('HistoryImported', (payload) => {
      this.sendToBackground('IMPORT_COMPLETED', payload);
    });

    EventBus.getInstance().on('Heartbeat', (payload) => {
      this.sendToBackground('PONG', payload);
    });

    const liveEvents = ['LIVE_EVENT', 'ACCOUNT_UPDATED', 'BALANCE_UPDATED', 'EQUITY_UPDATED', 'POSITION_OPENED', 'POSITION_MODIFIED', 'POSITION_CLOSED'];
    liveEvents.forEach(eventType => {
      EventBus.getInstance().on(eventType, (payload) => {
        this.sendToBackground(eventType, payload);
      });
    });

    // ── PRIMARY: Listen for messages from Background Service Worker ──
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const type = message?.type || 'UNKNOWN';
        console.log(`${TAG} ──────────────────────────────────────`);
        console.log(`${TAG} Received from Background: ${type}`);
        console.log(`${TAG} Request ID: ${message?.requestId || 'none'}`);
        console.log(`${TAG} Sender: ${sender?.id || 'unknown'}`);

        this.handleMessage(message, sendResponse);
        return true; // Keep sendResponse channel open for async
      });

      console.log(`${TAG} chrome.runtime.onMessage listener registered`);
    }

    // ── FALLBACK: Listen for same-tab postMessages ──
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        if (!event.data || typeof event.data !== 'object') return;
        const data = event.data;
        if (data.source !== TF_SOURCE_WEB) return;

        console.log(`${TAG} Received via window.postMessage: ${data.type}`);
        this.handleMessage(data, null);
      });
    }
  }

  async handleMessage(message, sendResponse) {
    const { type, requestId, payload } = message;
    Logger.info('BridgeDispatcher', `Processing: ${type} (${requestId})`, payload);

    switch (type) {
      case 'PING':
      case 'GET_EXTENSION_INFO': {
        const response = this.createResponse('PONG', {
          isInstalled: true,
          version: '3.4.0',
          browser: 'Chrome',
          status: 'connected',
          latency: 0,
        }, requestId);

        console.log(`${TAG} Sending PONG response`);
        if (sendResponse) {
          sendResponse(response);
        } else {
          this.sendToBackground('PONG', response.payload, requestId);
        }
        break;
      }

      case 'DISCOVER_ACCOUNTS': {
        console.log(`${TAG} Running account discovery on Exness page...`);
        try {
          const accounts = await DiscoveryEngine.getInstance().discoverAccounts();
          console.log(`${TAG} Discovered ${accounts?.length || 0} accounts`);

          const response = this.createResponse('ACCOUNT_LIST', accounts, requestId);
          if (sendResponse) {
            sendResponse(response);
          } else {
            this.sendToBackground('ACCOUNT_LIST', accounts, requestId);
          }
        } catch (err) {
          console.error(`${TAG} Account discovery failed:`, err);
          const response = this.createResponse('ERROR', null, requestId, {
            code: 'NO_ACCOUNTS_FOUND',
            message: 'Unable to discover Exness trading accounts.',
            details: String(err),
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
        console.log(`${TAG} Starting import for accounts: ${accountIds.join(', ')}`);

        const startedResponse = this.createResponse('IMPORT_STARTED', {
          stage: 'connecting',
          fetchedTrades: 0,
          totalTrades: 0,
          percentage: 0,
        }, requestId);

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
          }
        );
        break;
      }

      case 'HEARTBEAT': {
        const response = this.createResponse('PONG', { status: 'alive', latency: 0 }, requestId);
        if (sendResponse) {
          sendResponse(response);
        } else {
          this.sendToBackground('PONG', response.payload, requestId);
        }
        break;
      }

      default:
        Logger.warn('BridgeDispatcher', `Unhandled message type: ${type}`);
        break;
    }
  }

  createResponse(type, payload = null, requestId = null, error = null) {
    return createMessageEnvelope(type, payload, requestId, error);
  }

  sendToBackground(type, payload = null, requestId = null, error = null) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return;
    const envelope = createMessageEnvelope(type, payload, requestId, error);
    
    // Mark as push event so the background knows to forward to TradeFourge tabs
    envelope.isPushEvent = true;

    console.log(`${TAG} Pushing ${type} to background (requestId: ${envelope.requestId})`);

    chrome.runtime.sendMessage(envelope, (response) => {
      if (chrome.runtime.lastError) {
        // Suppress expected errors when background isn't listening yet
        console.warn(`${TAG} sendToBackground error for ${type}:`, chrome.runtime.lastError.message);
      }
    });
  }
}
