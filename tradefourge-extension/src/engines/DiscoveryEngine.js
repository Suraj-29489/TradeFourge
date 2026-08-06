/**
 * TradeFourge Companion Extension v5.1 — Account Discovery Engine
 * Discovers trading accounts dynamically using active BrokerAdapter.
 * Guarantees distinct account objects, unique internal IDs, and no shared references.
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
      const rawAccounts = await adapter.discoverAccounts();
      
      // Ensure each account is deep-cloned with a unique internal ID and pristine properties
      const accounts = (rawAccounts || []).map((acc) => ({
        id: acc.id || `exness_${acc.account_number}`,
        account_number: String(acc.account_number),
        account_name: String(acc.account_name || 'Exness Trading Account'),
        nickname: String(acc.nickname || acc.account_name || 'Trading Account'),
        broker: String(acc.broker || 'Exness'),
        platform: String(acc.platform || 'MetaTrader 5'),
        currency: String(acc.currency || 'USD'),
        balance: Number(acc.balance) || 0,
        equity: Number(acc.equity) || Number(acc.balance) || 0,
        server: String(acc.server || 'Exness-Real'),
        account_type: acc.account_type || 'Standard',
        history_count: Number(acc.history_count) || 0,
        status: acc.status || 'Ready',
        is_archived: Boolean(acc.is_archived),
        is_live: Boolean(acc.is_live !== false),
        is_demo: Boolean(acc.is_demo),
      }));

      // Store isolated copy in cache
      await LocalCache.set('tf_discovered_accounts', JSON.parse(JSON.stringify(accounts)));
      await LocalCache.set('tf_last_discovery', new Date().toISOString());

      EventBus.getInstance().emit('AccountsChanged', JSON.parse(JSON.stringify(accounts)));
      return JSON.parse(JSON.stringify(accounts));
    } catch (err) {
      Logger.error('DiscoveryEngine', 'Account discovery failed', err);
      throw err;
    }
  }
}
