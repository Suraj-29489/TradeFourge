/**
 * TradeFourge Extension — Content Script (Isolated World)
 *
 * Checks supported website hosts (terminal.exness.*, my.exness.*),
 * injects `inject.js` into the page DOM, and relays capture stats to chrome.storage.
 */

(function () {
  'use strict';

  // 1. Double-injection prevention using DOM dataset attribute
  if (document.documentElement.dataset.tradefourgeInjected) {
    return;
  }
  document.documentElement.dataset.tradefourgeInjected = 'true';

  // 2. Validate target website hostname
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
    // Quietly exit on unsupported pages
    return;
  }

  // 3. Inject script into webpage DOM context (Main World)
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
    console.log('[TradeFourge Extension] Injected page context script.');
  } catch (err) {
    console.error('[TradeFourge Extension] TradeFourge Extension failed to initialize.', err);
    return;
  }

  // 4. Bridge window.postMessage from inject.js to extension storage
  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (event.data && event.data.source === 'tradefourge-injected' && event.data.type === 'WS_MESSAGE_CAPTURED') {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['tf_messages_captured'], function (result) {
          const count = (result.tf_messages_captured || 0) + 1;
          chrome.storage.local.set({
            tf_messages_captured: count,
            tf_last_updated: new Date().toISOString()
          });
        });
      }
    }
  });

})();
