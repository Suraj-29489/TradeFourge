/**
 * TradeFourge Companion Extension v3.4 — Exness Content Script Entry
 * Injected into Exness broker pages only.
 * Initializes BridgeDispatcher, BrokerAdapter engines, and EventBus.
 */

import { BridgeDispatcher } from './src/bridge/dispatcher.js';
import { Logger } from './src/logger/Logger.js';

(function () {
  'use strict';

  // Prevent double-injection
  if (document.documentElement.dataset.tradefourgeV3Injected) {
    return;
  }
  document.documentElement.dataset.tradefourgeV3Injected = 'true';

  const TAG = '[TradeFourge Companion]';

  console.log(`${TAG} Content Script Loaded (Exness Page)`);
  console.log(`${TAG} URL: ${window.location.href}`);
  console.log(`${TAG} Extension ID: ${chrome.runtime.id}`);
  Logger.success('ContentScript', 'TradeFourge Companion Extension v3.4 initializing on Exness page...');

  try {
    BridgeDispatcher.getInstance().init();
    console.log(`${TAG} Bridge Initialized`);
    console.log(`${TAG} Listening for Background Messages via chrome.runtime.onMessage`);
    console.log(`${TAG} Listening for Website Messages via window.postMessage (fallback)`);
  } catch (err) {
    console.error(`${TAG} Failed to initialize BridgeDispatcher`, err);
    Logger.error('ContentScript', 'Failed to initialize BridgeDispatcher', err);
  }
})();
