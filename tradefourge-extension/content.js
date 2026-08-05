/**
 * TradeFourge Extension — Content Script (Isolated World)
 *
 * Injects Event Pipeline modules and `inject.js` into page DOM in dependency order.
 * Bridges state updates to extension storage for popup subscriber counters.
 */

(function () {
  'use strict';

  if (document.documentElement.dataset.tradefourgeInjected) {
    return;
  }
  document.documentElement.dataset.tradefourgeInjected = 'true';

  function isSupportedWebsite(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return /^terminal\.exness\.[a-z0-9.-]+$/i.test(host) || /^my\.exness\.[a-z0-9.-]+$/i.test(host);
    } catch (e) {
      return false;
    }
  }

  if (!isSupportedWebsite(window.location.href)) {
    return;
  }

  // Script injection sequence in strict dependency order
  const pipelineScripts = [
    'src/events/eventTypes.js',
    'src/models/BaseEvent.js',
    'src/models/TickEvent.js',
    'src/models/PositionEvent.js',
    'src/models/OrderEvent.js',
    'src/models/DealEvent.js',
    'src/models/AccountEvent.js',
    'src/events/dispatcher.js',
    'src/validation/validator.js',
    'src/parser/tickParser.js',
    'src/parser/positionParser.js',
    'src/parser/orderParser.js',
    'src/parser/dealParser.js',
    'src/parser/accountParser.js',
    'src/parser/parserManager.js',
    'src/state/runtimeState.js',
    'src/capture/websocketCapture.js',
    'utils/logger.js',
    'inject.js'
  ];

  function injectScriptsSequentially(index) {
    if (index >= pipelineScripts.length) {
      console.log('[TradeFourge ContentScript] All Event Pipeline modules loaded.');
      return;
    }

    const scriptPath = pipelineScripts[index];
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(scriptPath);
    script.onload = function () {
      this.remove();
      injectScriptsSequentially(index + 1);
    };
    script.onerror = function () {
      console.error('[TradeFourge ContentScript] Failed to load script: ' + scriptPath);
      injectScriptsSequentially(index + 1);
    };
    (document.head || document.documentElement).appendChild(script);
  }

  try {
    injectScriptsSequentially(0);
  } catch (err) {
    console.error('[TradeFourge ContentScript] TradeFourge Extension failed to initialize.', err);
    return;
  }

  // Bridge postMessage state updates from runtimeState to chrome.storage.local
  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (event.data && event.data.source === 'tradefourge-injected' && event.data.type === 'TF_STATE_UPDATE') {
      const counts = event.data.detail ? event.data.detail.counts : null;
      if (counts && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          tf_messages_captured: counts.totalCaptured || 0,
          tf_ticks_captured: counts.ticks || 0,
          tf_orders_captured: counts.orders || 0,
          tf_deals_captured: counts.deals || 0,
          tf_positions_captured: counts.positions || 0,
          tf_accounts_captured: counts.accountUpdates || 0,
          tf_last_updated: new Date().toISOString()
        });
      }
    }
  });

})();
