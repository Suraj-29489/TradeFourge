/**
 * TradeFourge Companion Extension v3.0 — Background Service Worker
 * Manages Manifest V3 extension lifecycle, badge state, and chrome.runtime message dispatching.
 */

self.addEventListener('install', (event) => {
  console.log('[TradeFourge Background] Companion Extension v3.0 Installed.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[TradeFourge Background] Companion Extension Service Worker Active.');
});

// Extension action popup or badge handler
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'PING') {
      sendResponse({
        source: 'tradefourge-extension',
        type: 'PONG',
        version: '3.0.0',
        status: 'active',
      });
    }
    return true;
  });
}
