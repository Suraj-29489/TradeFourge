/**
 * TradeFourge Companion Extension v3.0 — Bridge Dispatcher
 * Bidirectional window.postMessage & chrome.runtime message router connecting web app to extension runtime.
 */

import { TF_SOURCE_EXTENSION, TF_SOURCE_WEB, createMessageEnvelope } from '../types/protocol.js';
import { DiscoveryEngine } from '../engines/DiscoveryEngine.js';
import { HistoryImportEngine } from '../engines/HistoryImportEngine.js';
import { LiveRuntimeMonitor } from '../engines/LiveRuntimeMonitor.js';
import { HeartbeatSystem } from '../heartbeat/HeartbeatSystem.js';
import { EventBus } from '../eventBus/EventBus.js';
import { Logger } from '../logger/Logger.js';

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

    Logger.success('BridgeDispatcher', 'Initializing Web ↔ Extension Bridge Dispatcher...');

    // Start background engines
    HeartbeatSystem.getInstance().start();
    LiveRuntimeMonitor.getInstance().start();

    // Listen for internal EventBus emissions to forward to window.postMessage
    EventBus.getInstance().on('HistoryImported', (payload) => {
      this.postToWeb('IMPORT_COMPLETED', payload);
    });

    EventBus.getInstance().on('Heartbeat', (payload) => {
      this.postToWeb('PONG', payload);
    });

    // Listen for incoming postMessages from website
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        if (!event.data || typeof event.data !== 'object') return;
        const data = event.data;

        if (data.source !== TF_SOURCE_WEB) return;

        this.handleWebMessage(data);
      });
    }
  }

  async handleWebMessage(message) {
    const { type, requestId, payload } = message;
    Logger.info('BridgeDispatcher', `Received request from website: ${type} (${requestId})`, payload);

    switch (type) {
      case 'PING':
      case 'GET_EXTENSION_INFO':
        this.postToWeb('PONG', {
          isInstalled: true,
          version: '3.0.0',
          browser: 'Chrome',
          status: 'connected',
          latency: 24,
        }, requestId);
        break;

      case 'DISCOVER_ACCOUNTS':
        try {
          const accounts = await DiscoveryEngine.getInstance().discoverAccounts();
          this.postToWeb('ACCOUNT_LIST', accounts, requestId);
        } catch (err) {
          this.postToWeb('ERROR', null, requestId, {
            code: 'NO_ACCOUNTS_FOUND',
            message: 'Unable to discover Exness trading accounts.',
            details: err,
          });
        }
        break;

      case 'IMPORT_SELECTED_ACCOUNTS':
        const accountIds = payload?.accountIds || ['2200009441'];
        this.postToWeb('IMPORT_STARTED', { stage: 'connecting', fetchedTrades: 0, totalTrades: 4862, percentage: 0 }, requestId);

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

      case 'HEARTBEAT':
        this.postToWeb('PONG', { status: 'alive', latency: 18 }, requestId);
        break;

      default:
        Logger.warn('BridgeDispatcher', `Unhandled web message type: ${type}`);
        break;
    }
  }

  postToWeb(type, payload = null, requestId = null, error = null) {
    if (typeof window === 'undefined') return;

    const envelope = createMessageEnvelope(type, payload, requestId, error);
    window.postMessage(envelope, '*');
  }
}
