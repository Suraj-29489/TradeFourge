/**
 * TradeFourge Extension — Popup UI Logic
 */

document.addEventListener('DOMContentLoaded', function () {
  const siteTextEl = document.getElementById('site-text');
  const siteDotEl = document.getElementById('site-dot');
  const messageCountEl = document.getElementById('message-count');

  // 1. Fetch captured message count from storage
  function updateMessageCount() {
    if (typeof TradeFourgeStorage !== 'undefined') {
      TradeFourgeStorage.getMessageCount().then((count) => {
        messageCountEl.textContent = count.toLocaleString();
      });
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['tf_messages_captured'], function (result) {
        messageCountEl.textContent = (result.tf_messages_captured || 0).toLocaleString();
      });
    }
  }

  // 2. Check active tab URL for supported website detection
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

  updateMessageCount();
  checkActiveTab();

  // 3. Listen for dynamic storage updates while popup is open
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, namespace) {
      if (namespace === 'local' && changes.tf_messages_captured) {
        messageCountEl.textContent = (changes.tf_messages_captured.newValue || 0).toLocaleString();
      }
    });
  }
});
