/**
 * TradeFourge Companion Extension v3.3 — Injector Content Script
 * Lightweight script injected ONLY into TradeFourge web pages.
 * Exposes the Extension ID to the main world via a DOM attribute
 * so the website can call chrome.runtime.sendMessage(extensionId, ...).
 */

(function () {
  'use strict';

  // Stamp extension ID onto <html> element
  const extensionId = chrome.runtime.id;
  document.documentElement.setAttribute('data-tradefourge-extension-id', extensionId);

  console.log('[TradeFourge Injector] Extension ID exposed to webpage:', extensionId);
})();
