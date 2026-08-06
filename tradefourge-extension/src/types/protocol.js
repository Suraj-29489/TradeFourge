/**
 * TradeFourge Companion Extension v3.4 — Protocol Definitions
 * Message envelope and event type constants matching tradefourge-web bridge protocol.
 */

export const TF_SOURCE_WEB = 'tradefourge-web';
export const TF_SOURCE_EXTENSION = 'tradefourge-extension';

export const TF_MESSAGE_TYPES = {
  PING: 'PING',
  PONG: 'PONG',
  GET_EXTENSION_INFO: 'GET_EXTENSION_INFO',
  GET_BROWSER_INFO: 'GET_BROWSER_INFO',
  HEARTBEAT: 'HEARTBEAT',
  DISCOVER_ACCOUNTS: 'DISCOVER_ACCOUNTS',
  ACCOUNT_DISCOVERED: 'ACCOUNT_DISCOVERED',
  ACCOUNT_LIST: 'ACCOUNT_LIST',
  IMPORT_SELECTED_ACCOUNTS: 'IMPORT_SELECTED_ACCOUNTS',
  IMPORT_STARTED: 'IMPORT_STARTED',
  IMPORT_PROGRESS: 'IMPORT_PROGRESS',
  IMPORT_COMPLETED: 'IMPORT_COMPLETED',
  LIVE_EVENT: 'LIVE_EVENT',
  ACCOUNT_UPDATED: 'ACCOUNT_UPDATED',
  BALANCE_UPDATED: 'BALANCE_UPDATED',
  EQUITY_UPDATED: 'EQUITY_UPDATED',
  POSITION_OPENED: 'POSITION_OPENED',
  POSITION_MODIFIED: 'POSITION_MODIFIED',
  POSITION_CLOSED: 'POSITION_CLOSED',
  ERROR: 'ERROR',
};

/**
 * Creates a standard TradeFourge message envelope
 * @param {string} type
 * @param {any} payload
 * @param {string} [requestId]
 * @param {any} [error]
 * @returns {object}
 */
export function createMessageEnvelope(type, payload = null, requestId = null, error = null) {
  return {
    source: TF_SOURCE_EXTENSION,
    type,
    requestId: requestId || `ext_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    version: '3.4.0',
    payload,
    error,
  };
}
