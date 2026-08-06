/**
 * TradeFourge Companion Extension v5.1 — Injector Content Script
 * Lightweight script injected ONLY into TradeFourge web pages.
 * Exposes the Extension ID to the main world via a DOM attribute
 * and forwards push messages from the background service worker to the web page.
 */

(function () {
  'use strict';

  const TAG = '[TradeFourge Injector]';

  // Stamp extension ID onto <html> element
  const extensionId = chrome.runtime.id;
  document.documentElement.setAttribute('data-tradefourge-extension-id', extensionId);

  console.log(`${TAG} Extension ID exposed to webpage: ${extensionId} (v5.1.0)`);

  // Listen for messages from the background service worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log(`${TAG} Background → Web | type: ${message?.type} | requestId: ${message?.requestId || 'none'}`);
      
      // Forward the message to the webpage via window.postMessage
      if (typeof window !== 'undefined') {
        window.postMessage(message, '*');
      }

      sendResponse({ received: true });
      return true;
    });
    console.log(`${TAG} Message listener registered for push events.`);
  }
})();
