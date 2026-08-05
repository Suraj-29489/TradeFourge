/**
 * TradeFourge Companion Extension v3.3 — Bridge Dispatcher
 * Runs in the Exness tab content script.
 * Handles messages from the Background Service Worker via chrome.runtime.onMessage
 * and from same-tab postMessage (legacy fallback).
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

    Logger.success('BridgeDispatcher', 'Initializing Exness ↔ Extension Bridge Dispatcher v3.3...');

    // Start broker engines
    HeartbeatSystem.getInstance().start();
    LiveRuntimeMonitor.getInstance().start();

    // Listen for EventBus emissions
    EventBus.getInstance().on('HistoryImported', (payload) => {
      this.postToWeb('IMPORT_COMPLETED', payload);
    });

    EventBus.getInstance().on('Heartbeat', (payload) => {
      this.postToWeb('PONG', payload);
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
          version: '3.3.0',
          browser: 'Chrome',
          status: 'connected',
          latency: 0,
        }, requestId);

        console.log(`${TAG} Sending PONG response`);
        if (sendResponse) {
          sendResponse(response);
        } else {
          this.postToWeb('PONG', response.payload, requestId);
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
            this.postToWeb('ACCOUNT_LIST', accounts, requestId);
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
            this.postToWeb('ERROR', null, requestId, response.error);
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
          this.postToWeb('IMPORT_STARTED', startedResponse.payload, requestId);
        }

        HistoryImportEngine.getInstance().importSelectedAccounts(
          accountIds,
          (progress) => {
            this.postToWeb('IMPORT_PROGRESS', progress, requestId);
          },
          (completed) => {
            this.postToWeb('IMPORT_COMPLETED', completed, requestId);
          }
        );
        break;
      }

      case 'HEARTBEAT': {
        const response = this.createResponse('PONG', { status: 'alive', latency: 0 }, requestId);
        if (sendResponse) {
          sendResponse(response);
        } else {
          this.postToWeb('PONG', response.payload, requestId);
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

  postToWeb(type, payload = null, requestId = null, error = null) {
    if (typeof window === 'undefined') return;
    const envelope = createMessageEnvelope(type, payload, requestId, error);
    window.postMessage(envelope, '*');
  }
}
