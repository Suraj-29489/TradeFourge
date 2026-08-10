/**
 * TradeFourge Companion Extension v5.1.2 — Exness Content Script Entry
 * Injected into Exness broker pages only.
 *
 * Lifecycle:
 *   1. Double-injection guard (dataset attribute on <html>).
 *   2. Context validity check before initialization.
 *   3. BridgeDispatcher.init() — starts heartbeat, live monitor, EventBus subscriptions.
 *   4. destroyTradeForgeContext() on pagehide.
 *      - Clears all timers, EventBus listeners, ports, singletons.
 *      - Removes dataset guard so reinjection is clean.
 *
 * NOTE: Do NOT use window.addEventListener('unload', ...) or ('beforeunload', ...).
 * Exness pages set Permissions-Policy: unload=() which makes those events throw
 * "Permissions policy violation: unload is not allowed in this document."
 * Use 'pagehide' instead — it fires on navigation, tab close, and bfcache entry.
 */

import { BridgeDispatcher } from './src/bridge/dispatcher.js';
import { ConnectionManager } from './src/connection/ConnectionManager.js';
import { Logger } from './src/logger/Logger.js';
import { isExtensionContextValid } from './src/utils/contextCheck.js';

(function () {
  'use strict';

  // Double-injection guard — prevents re-running if content script is already active
  if (document.documentElement.dataset.tradefourgeV5Injected) {
    return;
  }
  document.documentElement.dataset.tradefourgeV5Injected = 'true';
  document.documentElement.setAttribute('data-tradefourge-version', '5.1.2');

  if (!isExtensionContextValid()) {
    return;
  }

  console.log('[TradeFourge Companion] Content Script v5.1.2 loaded on Exness page.');

  try {
    BridgeDispatcher.getInstance().init();
    Logger.success('ContentScript', 'TradeFourge Companion Extension v5.1.2 active on Exness page.');
  } catch (err) {
    if (err && !err.message?.includes('Extension context invalidated')) {
      Logger.debug('ContentScript', 'Failed to initialize BridgeDispatcher', { error: err });
    }
  }

  // Page lifecycle teardown — uses 'pagehide' only.
  // 'unload' and 'beforeunload' are FORBIDDEN on Exness pages (Permissions-Policy).
  const onPageHide = () => {
    try {
      ConnectionManager.instance = null;
      BridgeDispatcher.getInstance().destroyTradeForgeContext();
    } catch (e) {}
  };

  window.addEventListener('pagehide', onPageHide);
})();
