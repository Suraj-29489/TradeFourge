/**
 * TradeFourge Companion Extension v3.0 — Content Script (Isolated World & Main Page Bridge)
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

  Logger.success('ContentScript', 'TradeFourge Companion Extension v3.0 initializing...');

  try {
    BridgeDispatcher.getInstance().init();
  } catch (err) {
    Logger.error('ContentScript', 'Failed to initialize BridgeDispatcher', err);
  }
})();
