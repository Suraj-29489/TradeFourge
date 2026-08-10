/**
 * TradeFourge Companion Extension v5.1.2 — Background Service Worker Watchdog
 * Fully instrumented Manifest V3 background service worker with runtime state tracking,
 * lifecycle watchdog listeners (onSuspend, onSuspendCanceled, onConnect),
 * dynamic content script verification, and silent recovery.
 */

const VERSION = '5.1.2';
const TAG = '[Background]';

console.log(`${TAG} Service Worker v${VERSION} initializing...`);

// ─── Phase 7: Background Service Worker Watchdog ────────────────────────────

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onInstalled.addListener((details) => {
    console.log(`${TAG} Watchdog: Extension installed/updated (reason: ${details.reason}, v${VERSION})`);
  });

  chrome.runtime.onStartup.addListener(() => {
    console.log(`${TAG} Watchdog: Service Worker starting up...`);
  });

  if (chrome.runtime.onSuspend) {
    chrome.runtime.onSuspend.addListener(() => {
      console.log(`${TAG} Watchdog: Service Worker suspending (idle timeout)...`);
    });
  }

  if (chrome.runtime.onSuspendCanceled) {
    chrome.runtime.onSuspendCanceled.addListener(() => {
      console.log(`${TAG} Watchdog: Service Worker suspension canceled.`);
    });
  }

  if (chrome.runtime.onConnect) {
    chrome.runtime.onConnect.addListener((port) => {
      console.log(`${TAG} Watchdog: Connection established with port '${port.name}' from tab ${port.sender?.tab?.id || 'unknown'}`);
      port.onDisconnect.addListener(() => {
        console.log(`${TAG} Watchdog: Port '${port.name}' disconnected.`);
      });
    });
  }
}

// ─── Tab Router & Centralized Targeting ───────────────────────────────────

async function findExnessTab() {
  if (typeof chrome === 'undefined' || !chrome.tabs) return null;

  console.log('[EXNESS TAB ROUTER] Scanning browser tabs...');

  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError || !tabs) {
        console.log('[EXNESS TAB ROUTER] Tab query error:', chrome.runtime.lastError?.message);
        resolve(null);
        return;
      }

      const candidates = tabs.filter((t) => {
        if (!t.url) return false;
        try {
          const u = new URL(t.url);
          if (u.protocol !== 'https:') return false;
          const host = u.hostname.toLowerCase();
          const isExness = host.includes('exness') || host.includes('exness-trade') || host.includes('exness.cloud');
          if (!isExness) return false;

          const path = u.pathname.toLowerCase();
          if (
            path.includes('/stats/') ||
            path.includes('/service_worker/') ||
            path.includes('/ns.html') ||
            u.href.includes('about:blank') ||
            u.href.includes('sw_iframe.html')
          ) {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      });

      if (candidates.length === 0) {
        console.log('[EXNESS TAB ROUTER] No candidate Exness tabs found.');
        resolve(null);
        return;
      }

      candidates.forEach((t) => {
        console.log(`[EXNESS TAB ROUTER] Candidate: tabId=${t.id} url=${t.url}`);
      });

      // Priority ranking:
      // 1. /pa/trading/accounts
      // 2. /pa/trading/ordersHistory
      // 3. /pa/trading/
      // 4. Any other /pa/...
      const selectedTab = candidates.find((t) => t.url.includes('/pa/trading/accounts')) ||
        candidates.find((t) => t.url.includes('/pa/trading/ordersHistory')) ||
        candidates.find((t) => t.url.includes('/pa/trading')) ||
        candidates.find((t) => t.url.includes('/pa/')) ||
        candidates[0];

      console.log(`[EXNESS TAB ROUTER] Selected Exness tab: tabId=${selectedTab.id}`);
      console.log(`[EXNESS TAB ROUTER] Target URL: ${selectedTab.url}`);
      resolve(selectedTab);
    });
  });
}

async function getExnessTabs() {
  const tab = await findExnessTab();
  return tab ? [tab] : [];
}

async function getTradeFourgeTabs() {
  if (typeof chrome === 'undefined' || !chrome.tabs) return [];
  return new Promise((resolve) => {
    chrome.tabs.query(
      {
        url: [
          'http://localhost/*',
          'http://127.0.0.1/*',
          'https://*.tradefourge.com/*',
          'https://*.vercel.app/*',
          'https://tradefourge.vercel.app/*',
        ],
      },
      (tabs) => {
        if (chrome.runtime.lastError) {
          resolve([]);
        } else {
          resolve(tabs || []);
        }
      }
    );
  });
}

// ─── Content Script Lifecycle Verification & Dynamic Reinjection ────────────

async function pingContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'PING', requestId: `ping_cs_${Date.now()}` }, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function ensureContentScriptReady(tabId) {
  const tab = await new Promise((r) => {
    chrome.tabs.get(tabId, (t) => {
      if (chrome.runtime.lastError) r(null);
      else r(t);
    });
  });

  if (!tab) return false;

  if (tab.status === 'loading') {
    await new Promise((resolve) => {
      const listener = (tId, changeInfo) => {
        if (tId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 5000);
    });
  }

  let isReady = await pingContentScript(tabId);
  if (isReady) return true;

  try {
    if (chrome.scripting) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['dist/content.js'],
      });
      await new Promise((r) => setTimeout(r, 250));
      isReady = await pingContentScript(tabId);
      if (isReady) return true;
    }
  } catch (err) {}

  const retries = [300, 600, 1200, 2400];
  for (const delay of retries) {
    await new Promise((r) => setTimeout(r, delay));
    isReady = await pingContentScript(tabId);
    if (isReady) return true;
  }

  return false;
}

// ─── Push Event Broadcaster ──────────────────────────────────────────────────

async function forwardToTradeFourgeTabs(message) {
  const tfTabs = await getTradeFourgeTabs();
  tfTabs.forEach((tab) => {
    chrome.tabs.sendMessage(tab.id, message, () => {
      if (chrome.runtime.lastError) {
        // Suppress expected delivery warning
      }
    });
  });
}

// ─── Message Handling ───────────────────────────────────────────────────────

async function handleMessage(message, sender, sendResponse, isExternal) {
  const type = message?.type || 'UNKNOWN';
  const requestId = message?.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  if (!isExternal && message.isPushEvent) {
    await forwardToTradeFourgeTabs(message);
    sendResponse({ status: 'SUCCESS', result: 'Pushed to TradeFourge tabs', timestamp: Date.now() });
    return;
  }

  if (type === 'PING' || type === 'GET_EXTENSION_INFO') {
    const targetTab = await findExnessTab();
    sendResponse({
      source: 'tradefourge-extension',
      type: 'PONG',
      requestId,
      timestamp: Date.now(),
      version: VERSION,
      payload: {
        isInstalled: true,
        version: VERSION,
        browser: 'Chrome',
        status: 'connected',
        latency: 0,
        exnessTabsCount: targetTab ? 1 : 0,
        extensionId: chrome.runtime.id,
      },
    });
    return;
  }

  if (type === 'DISCOVER_ACCOUNTS') {
    const targetTab = await findExnessTab();
    if (!targetTab) {
      sendResponse({
        source: 'tradefourge-extension',
        type: 'ACCOUNT_LIST',
        requestId,
        version: VERSION,
        payload: [],
        error: {
          code: 'EXNESS_TAB_NOT_FOUND',
          message: 'No authenticated Exness tab found.',
          stage: 'DISCOVERING',
          suggestedAction: 'Open my.exness.com in your browser.',
        },
      });
      return;
    }

    const isReady = await ensureContentScriptReady(targetTab.id);
    if (!isReady) {
      console.log('[EXNESS TAB ROUTER] Content script not reachable in selected Exness tab.');
      sendResponse({
        source: 'tradefourge-extension',
        type: 'ACCOUNT_LIST',
        requestId,
        version: VERSION,
        payload: [],
        error: {
          code: 'EXNESS_CONTENT_SCRIPT_UNREACHABLE',
          message: 'Content script not reachable in selected Exness tab.',
          stage: 'DISCOVERING',
          suggestedAction: 'Reload your Exness tab (my.exness.com).',
        },
      });
      return;
    }

    chrome.tabs.sendMessage(targetTab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          source: 'tradefourge-extension',
          type: 'ACCOUNT_LIST',
          requestId,
          version: VERSION,
          payload: [],
          error: {
            code: 'EXNESS_CONTENT_SCRIPT_UNREACHABLE',
            message: chrome.runtime.lastError.message,
            stage: 'DISCOVERING',
          },
        });
        return;
      }
      sendResponse(response);
    });
    return;
  }

  if (type === 'IMPORT_SELECTED_ACCOUNTS') {
    const targetTab = await findExnessTab();
    if (!targetTab) {
      sendResponse({
        source: 'tradefourge-extension',
        type: 'IMPORT_STARTED',
        requestId,
        version: VERSION,
        payload: { stage: 'connecting', fetchedTrades: 0, totalTrades: 0, percentage: 0 },
        error: {
          code: 'EXNESS_TAB_NOT_FOUND',
          message: 'No authenticated Exness tab found.',
          stage: 'CONNECTING',
        },
      });
      return;
    }

    const isReady = await ensureContentScriptReady(targetTab.id);
    if (!isReady) {
      sendResponse({
        source: 'tradefourge-extension',
        type: 'IMPORT_STARTED',
        requestId,
        version: VERSION,
        payload: { stage: 'connecting', fetchedTrades: 0, totalTrades: 0, percentage: 0 },
        error: {
          code: 'EXNESS_CONTENT_SCRIPT_UNREACHABLE',
          message: 'Could not establish connection with Exness content script.',
          stage: 'CONNECTING',
        },
      });
      return;
    }

    chrome.tabs.sendMessage(targetTab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          source: 'tradefourge-extension',
          type: 'IMPORT_STARTED',
          requestId,
          version: VERSION,
          payload: { stage: 'connecting', fetchedTrades: 0, totalTrades: 0, percentage: 0 },
          error: {
            code: 'IMPORT_FAILED',
            message: chrome.runtime.lastError.message,
            stage: 'CONNECTING',
          },
        });
        return;
      }
      sendResponse(response);
    });
    return;
  }

  if (type === 'HEARTBEAT') {
    sendResponse({
      source: 'tradefourge-extension',
      type: 'PONG',
      requestId,
      version: VERSION,
      payload: { status: 'alive', latency: 0 },
    });
    return;
  }

  sendResponse({
    source: 'tradefourge-extension',
    type: 'PONG',
    requestId,
    version: VERSION,
    payload: { isInstalled: true, status: 'active' },
  });
}

// ─── Listener Registration ──────────────────────────────────────────────────

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse, true);
    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse, false);
    return true;
  });

  console.log(`${TAG} Registered onMessageExternal + onMessage listeners.`);
}
