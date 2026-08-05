/**
 * TradeFourge Companion Extension v3.0 — Account Discovery Engine
 * Discovers trading accounts dynamically using active BrokerAdapter.
 */

import { AdapterManager } from '../adapters/AdapterManager.js';
import { EventBus } from '../eventBus/EventBus.js';
import { Logger } from '../logger/Logger.js';
import { LocalCache } from '../cache/LocalCache.js';

export class DiscoveryEngine {
  static instance = null;

  static getInstance() {
    if (!DiscoveryEngine.instance) {
      DiscoveryEngine.instance = new DiscoveryEngine();
    }
    return DiscoveryEngine.instance;
  }

  async discoverAccounts() {
    Logger.info('DiscoveryEngine', 'Initiating account discovery sequence...');
    const adapter = AdapterManager.getInstance().getActiveAdapter();

    try {
      const accounts = await adapter.discoverAccounts();
      await LocalCache.set('tf_discovered_accounts', accounts);
      await LocalCache.set('tf_last_discovery', new Date().toISOString());

      EventBus.getInstance().emit('AccountsChanged', accounts);
      return accounts;
    } catch (err) {
      Logger.error('DiscoveryEngine', 'Account discovery failed', err);
      throw err;
    }
  }
}
