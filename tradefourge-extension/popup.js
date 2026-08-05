/**
 * TradeFourge Extension v1.1 — Popup UI Logic
 */

document.addEventListener('DOMContentLoaded', function () {
  const siteTextEl = document.getElementById('site-text');
  const siteDotEl = document.getElementById('site-dot');

  const cntTotalEl = document.getElementById('cnt-total');
  const cntTicksEl = document.getElementById('cnt-ticks');
  const cntOrdersEl = document.getElementById('cnt-orders');
  const cntDealsEl = document.getElementById('cnt-deals');
  const cntPositionsEl = document.getElementById('cnt-positions');
  const cntAccountsEl = document.getElementById('cnt-accounts');

  function updateMetricsDisplay() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([
        'tf_messages_captured',
        'tf_ticks_captured',
        'tf_orders_captured',
        'tf_deals_captured',
        'tf_positions_captured',
        'tf_accounts_captured'
      ], function (result) {
        cntTotalEl.textContent = (result.tf_messages_captured || 0).toLocaleString();
        cntTicksEl.textContent = (result.tf_ticks_captured || 0).toLocaleString();
        cntOrdersEl.textContent = (result.tf_orders_captured || 0).toLocaleString();
        cntDealsEl.textContent = (result.tf_deals_captured || 0).toLocaleString();
        cntPositionsEl.textContent = (result.tf_positions_captured || 0).toLocaleString();
        cntAccountsEl.textContent = (result.tf_accounts_captured || 0).toLocaleString();
      });
    }
  }

  function checkActiveTab() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs.length > 0 && tabs[0].url) {
          const currentUrl = tabs[0].url;
          let isConnected = false;

          if (typeof TradeFourgeValidator !== 'undefined') {
            isConnected = TradeFourgeValidator.isSupportedWebsite(currentUrl);
          } else {
            isConnected = /https:\/\/(terminal|my)\.exness\./i.test(currentUrl);
          }

          if (isConnected) {
            siteTextEl.textContent = 'Connected';
            siteDotEl.classList.remove('disconnected');
          } else {
            siteTextEl.textContent = 'Not Connected';
            siteDotEl.classList.add('disconnected');
          }
        } else {
          siteTextEl.textContent = 'Not Connected';
          siteDotEl.classList.add('disconnected');
        }
      });
    } else {
      siteTextEl.textContent = 'Not Connected';
      siteDotEl.classList.add('disconnected');
    }
  }

  updateMetricsDisplay();
  checkActiveTab();

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, namespace) {
      if (namespace === 'local') {
        updateMetricsDisplay();
      }
    });
  }
});
