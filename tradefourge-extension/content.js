/**
 * TradeFourge Companion Extension v3.1 — Content Script Entry
 * Injects modular BridgeDispatcher, BrokerAdapter engines, and EventBus into DOM.
 */

import { BridgeDispatcher } from './src/bridge/dispatcher.js';
import { Logger } from './src/logger/Logger.js';

(function () {
  'use strict';

  if (document.documentElement.dataset.tradefourgeV3Injected) {
    return;
  }
  document.documentElement.dataset.tradefourgeV3Injected = 'true';

  console.log('[TradeFourge Companion] Content Script Loaded');
  Logger.success('ContentScript', 'TradeFourge Companion Extension v3.1 initializing...');

  try {
    BridgeDispatcher.getInstance().init();
    console.log('[TradeFourge Companion] Bridge Initialized');
    console.log('[TradeFourge Companion] Listening for Website Messages');
  } catch (err) {
    console.error('[TradeFourge Companion] Failed to initialize BridgeDispatcher', err);
    Logger.error('ContentScript', 'Failed to initialize BridgeDispatcher', err);
  }
})();
