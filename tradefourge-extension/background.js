/**
 * TradeFourge Extension — Background Service Worker
 *
 * Extension lifecycle management only.
 * No business logic, no WebSocket interception.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[TradeFourge Extension] Service worker initialized. Extension installed.');
    chrome.storage.local.set({
      tf_messages_captured: 0,
      tf_installed_at: new Date().toISOString()
    });
  } else if (details.reason === 'update') {
    console.log('[TradeFourge Extension] Extension updated to version ' + chrome.runtime.getManifest().version);
  }
});
