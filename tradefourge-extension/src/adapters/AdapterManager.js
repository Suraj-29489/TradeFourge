/**
 * TradeFourge Companion Extension v3.0 — Adapter Manager
 * Registry and router selecting active BrokerAdapter for runtime requests.
 */

import { ExnessAdapter } from './ExnessAdapter.js';
import { Logger } from '../logger/Logger.js';

export class AdapterManager {
  static instance = null;

  static getInstance() {
    if (!AdapterManager.instance) {
      AdapterManager.instance = new AdapterManager();
    }
    return AdapterManager.instance;
  }

  constructor() {
    this.adapters = [
      new ExnessAdapter(),
      // Future adapters: MT5Adapter, BinanceAdapter, cTraderAdapter, DXTradeAdapter, IBKRAdapter
    ];
  }

  /**
   * Get the active broker adapter for the specified URL or current window location.
   * @param {string} [url]
   * @returns {import('./BrokerAdapter.js').BrokerAdapter}
   */
  getActiveAdapter(url = window.location.href) {
    for (const adapter of this.adapters) {
      if (adapter.isCurrentPlatform(url)) {
        return adapter;
      }
    }
    // Default fallback to ExnessAdapter
    return this.adapters[0];
  }

  registerAdapter(adapter) {
    this.adapters.push(adapter);
    Logger.success('AdapterManager', `Registered broker adapter: ${adapter.brokerName}`);
  }
}
