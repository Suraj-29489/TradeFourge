/**
 * TradeFourge Companion Extension v3.0 — Abstract BrokerAdapter Interface
 * Extensible interface allowing multi-broker support (Exness, MT5 Direct, Binance, cTrader, etc.)
 */

export class BrokerAdapter {
  constructor(brokerName) {
    this.brokerName = brokerName;
  }

  /**
   * Check if current page URL belongs to this broker.
   * @param {string} url
   * @returns {boolean}
   */
  isCurrentPlatform(url) {
    throw new Error('isCurrentPlatform must be implemented by subclass.');
  }

  /**
   * Detect current login session & user status.
   * @returns {Promise<{ isLoggedId: boolean; userEmail?: string; status: string }>}
   */
  async detectSession() {
    throw new Error('detectSession must be implemented by subclass.');
  }

  /**
   * Discover active trading accounts.
   * @returns {Promise<Array<import('../types/protocol.js').DiscoveredAccount>>}
   */
  async discoverAccounts() {
    throw new Error('discoverAccounts must be implemented by subclass.');
  }

  /**
   * Fetch paginated trade history.
   * @param {string} accountNumber
   * @param {number} offset
   * @param {number} limit
   * @returns {Promise<{ trades: Array<any>; totalCount: number; hasMore: boolean }>}
   */
  async fetchHistoryPage(accountNumber, offset = 0, limit = 100) {
    throw new Error('fetchHistoryPage must be implemented by subclass.');
  }

  /**
   * Start live runtime monitoring for tick & order events.
   * @param {function(object): void} onEvent
   */
  startLiveMonitoring(onEvent) {
    throw new Error('startLiveMonitoring must be implemented by subclass.');
  }

  /**
   * Stop live monitoring.
   */
  stopLiveMonitoring() {
    // Optional override
  }
}
