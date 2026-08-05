/**
 * TradeFourge Extension v1.2 — Popup UI Logic
 */

document.addEventListener('DOMContentLoaded', function () {
  const siteTextEl = document.getElementById('site-text');
  const siteDotEl = document.getElementById('site-dot');

  const cntTotalEl = document.getElementById('cnt-total');
  const cntOpenTradesEl = document.getElementById('cnt-open-trades');
  const cntFloatingPnlEl = document.getElementById('cnt-floating-pnl');
  const cntSpreadEl = document.getElementById('cnt-spread');
  const cntWinRateEl = document.getElementById('cnt-win-rate');
  const cntDrawdownEl = document.getElementById('cnt-drawdown');

  function updateMetricsDisplay() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([
        'tf_messages_captured',
        'tf_open_trades_count',
        'tf_floating_pnl',
        'tf_current_spread',
        'tf_win_rate',
        'tf_drawdown_percent'
      ], function (result) {
        const total = result.tf_messages_captured || 0;
        const openTrades = result.tf_open_trades_count || 0;
        const floatPnl = result.tf_floating_pnl || 0;
        const spread = result.tf_current_spread || 0;
        const winRate = result.tf_win_rate || 0;
        const drawdown = result.tf_drawdown_percent || 0;

        cntTotalEl.textContent = total.toLocaleString();
        cntOpenTradesEl.textContent = openTrades.toLocaleString();

        const formattedPnl = (floatPnl >= 0 ? '+$' : '-$') + Math.abs(floatPnl).toFixed(2);
        cntFloatingPnlEl.textContent = formattedPnl;
        cntFloatingPnlEl.className = 'metric-val ' + (floatPnl >= 0 ? 'profit-positive' : 'profit-negative');

        cntSpreadEl.textContent = spread.toFixed(2);
        cntWinRateEl.textContent = winRate.toFixed(1) + '%';
        cntDrawdownEl.textContent = drawdown.toFixed(2) + '%';
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
