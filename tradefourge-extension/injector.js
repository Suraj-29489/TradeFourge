/**
 * TradeFourge Companion Extension v5.1.1 — Injector Content Script
 * Lightweight script injected ONLY into TradeFourge web pages.
 * Exposes Extension ID and version to main world via DOM attributes
 * and forwards push messages from background service worker to web page via window.postMessage.
 */

import { isExtensionContextValid } from './src/utils/contextCheck.js';

(function () {
  'use strict';

  const TAG = '[TradeFourge Injector]';
  const VERSION = '5.1.2';

  if (!isExtensionContextValid()) {
    return;
  }

  const extensionId = chrome.runtime.id;
  document.documentElement.setAttribute('data-tradefourge-extension-id', extensionId);
  document.documentElement.setAttribute('data-tradefourge-extension-version', VERSION);

  console.log(`${TAG} Extension ID exposed to webpage: ${extensionId} (v${VERSION})`);

  // Listen for messages from background service worker
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!isExtensionContextValid()) return false;
      if (typeof window !== 'undefined') {
        window.postMessage(message, '*');
      }
      sendResponse({ received: true, timestamp: Date.now() });
      return true;
    });
  }
})();
