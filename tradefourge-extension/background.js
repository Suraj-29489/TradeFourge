/**
 * TradeFourge Companion Extension v5.1 — Background Service Worker
 * Fully instrumented Manifest V3 cross-tab messaging pipeline with dynamic content script injection,
 * exponential backoff retries, and comprehensive message flow tracing.
 *
 * Message Flow Architecture:
 *   Website → chrome.runtime.sendMessage(extensionId, msg)
 *     → onMessageExternal listener (this file)
 *       → For PING: respond directly with PONG
 *       → For DISCOVER_ACCOUNTS / IMPORT: ensure content script ready → forward via chrome.tabs.sendMessage
 *         → Content script responds → background forwards response → website callback
 *   Content Script (Exness) → chrome.runtime.sendMessage(pushEvent)
 *     → onMessage listener (this file)
 *       → background forwards to all TradeFourge tabs via chrome.tabs.sendMessage
 */

const VERSION = '5.1.0';
const TAG = '[Background]';

console.log(`${TAG} Service Worker v${VERSION} initializing...`);

// ─── Startup & Recovery ─────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`${TAG} Extension installed/updated:`, details.reason);
});

chrome.runtime.onStartup.addListener(() => {
  console.log(`${TAG} Service Worker starting up...`);
});

// ─── Tab Discovery ──────────────────────────────────────────────────────────

async function getExnessTabs() {
  if (typeof chrome === 'undefined' || !chrome.tabs) return [];
  return new Promise((resolve) => {
    chrome.tabs.query(
      {
        url: [
          'https://*.exness.com/*',
          'https://*.exness.org/*',
          'https://*.exness.me/*',
          'https://*.exness.link/*',
          'https://*.exness-trade.com/*',
          'https://*.exness-trade.pro/*',
          'https://*.exness.cloud/*',
        ],
      },
      (tabs) => {
        if (chrome.runtime.lastError) {
          console.error(`${TAG} Error getting Exness tabs:`, chrome.runtime.lastError.message);
          resolve([]);
        } else {
          resolve(tabs || []);
        }
      }
    );
  });
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
          console.error(`${TAG} Error getting TradeFourge tabs:`, chrome.runtime.lastError.message);
          resolve([]);
        } else {
          resolve(tabs || []);
        }
      }
    );
  });
}

// ─── BUG 3 FIX: Content Script Verification & Dynamic Injection ──────────────

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
  // Step 1: Check if tab exists & status
  const tab = await new Promise((r) => {
    chrome.tabs.get(tabId, (t) => {
      if (chrome.runtime.lastError) r(null);
      else r(t);
    });
  });

  if (!tab) {
    console.warn(`${TAG} Tab ${tabId} does not exist.`);
    return false;
  }

  // Step 2: If tab is loading, wait until complete
  if (tab.status === 'loading') {
    console.log(`${TAG} Tab ${tabId} is loading. Waiting for page completion...`);
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

  // Step 3: Ping content script
  let isReady = await pingContentScript(tabId);
  if (isReady) {
    console.log(`${TAG} Content script on tab ${tabId} verified active (PONG).`);
    return true;
  }

  // Step 4: If not injected, inject dynamically via chrome.scripting.executeScript
  console.log(`${TAG} Content script not responding on tab ${tabId}. Attempting dynamic injection (dist/content.js)...`);
  try {
    if (chrome.scripting) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['dist/content.js'],
      });
      await new Promise((r) => setTimeout(r, 250));
      isReady = await pingContentScript(tabId);
      if (isReady) {
        console.log(`${TAG} Dynamically injected content script on tab ${tabId} successfully!`);
        return true;
      }
    }
  } catch (err) {
    console.warn(`${TAG} Dynamic script injection failed on tab ${tabId}:`, err?.message);
  }

  // Step 5: Retry ping with exponential backoff
  const retries = [300, 600, 1200, 2400];
  for (const delay of retries) {
    console.log(`${TAG} Retrying ping to content script on tab ${tabId} in ${delay}ms...`);
    await new Promise((r) => setTimeout(r, delay));
    isReady = await pingContentScript(tabId);
    if (isReady) {
      console.log(`${TAG} Content script responded after retry on tab ${tabId}!`);
      return true;
    }
  }

  console.error(`${TAG} FAILED to establish connection with Content Script on tab ${tabId} after retries.`);
  return false;
}

// ─── Push Event Broadcaster ──────────────────────────────────────────────────

async function forwardToTradeFourgeTabs(message) {
  const tfTabs = await getTradeFourgeTabs();
  const payloadSize = JSON.stringify(message || {}).length;
  console.log(`${TAG} Background → Website | type: ${message.type} | requestId: ${message.requestId || 'none'} | tabCount: ${tfTabs.length} | size: ${payloadSize}B | timestamp: ${Date.now()}`);

  tfTabs.forEach((tab) => {
    chrome.tabs.sendMessage(tab.id, message, () => {
      if (chrome.runtime.lastError) {
        // Suppress expected delivery warning if page unmounted
      }
    });
  });
}

// ─── Message Handler & Tracing Pipeline ─────────────────────────────────────

async function handleMessage(message, sender, sendResponse, isExternal) {
  const type = message?.type || 'UNKNOWN';
  const requestId = message?.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const timestamp = Date.now();
  const senderOrigin = sender?.url || sender?.origin || sender?.tab?.url || 'unknown';
  const senderType = isExternal ? 'EXTERNAL (website)' : 'INTERNAL (content script)';
  const payloadSize = JSON.stringify(message || {}).length;

  // BUG 4 & BUG 7 Structured Logging
  console.log(`${TAG} Website → Background | type: ${type} | requestId: ${requestId} | source: ${senderType} | origin: ${senderOrigin} | size: ${payloadSize}B | timestamp: ${timestamp}`);

  // Handle internal push events from Exness content script
  if (!isExternal && message.isPushEvent) {
    await forwardToTradeFourgeTabs(message);
    sendResponse({ status: 'SUCCESS', result: 'Pushed to TradeFourge tabs', timestamp: Date.now() });
    return;
  }

  // ── PING / GET_EXTENSION_INFO ──
  if (type === 'PING' || type === 'GET_EXTENSION_INFO') {
    const exnessTabs = await getExnessTabs();

    const pongResponse = {
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
        exnessTabsCount: exnessTabs.length,
        extensionId: chrome.runtime.id,
      },
    };

    console.log(`${TAG} Background → Website | type: PONG | requestId: ${requestId} | status: SUCCESS | timestamp: ${Date.now()}`);
    sendResponse(pongResponse);
    return;
  }

  // ── DISCOVER_ACCOUNTS ──
  if (type === 'DISCOVER_ACCOUNTS') {
    const exnessTabs = await getExnessTabs();
    console.log(`${TAG} DISCOVER_ACCOUNTS: Found ${exnessTabs.length} Exness tab(s)`);

    if (exnessTabs.length === 0) {
      console.warn(`${TAG} FAILED: No Exness tab detected.`);
      sendResponse({
        source: 'tradefourge-extension',
        type: 'ACCOUNT_LIST',
        requestId,
        version: VERSION,
        payload: [],
        error: {
          code: 'EXNESS_NOT_OPEN',
          message: 'No Exness trading tab is open in browser.',
          stage: 'DISCOVERING',
          reason: 'Zero Exness tabs returned by tab query',
          suggestedAction: 'Open my.exness.com in your browser and log into your trading account.',
        },
      });
      return;
    }

    const targetTab = exnessTabs[0];
    console.log(`${TAG} Background → Content Script | tabId: ${targetTab.id} | type: DISCOVER_ACCOUNTS | requestId: ${requestId} | timestamp: ${Date.now()}`);

    const isReady = await ensureContentScriptReady(targetTab.id);
    if (!isReady) {
      console.error(`${TAG} FAILED: Content script on tab ${targetTab.id} unreachable after retries.`);
      sendResponse({
        source: 'tradefourge-extension',
        type: 'ACCOUNT_LIST',
        requestId,
        version: VERSION,
        payload: [],
        error: {
          code: 'CONTENT_SCRIPT_UNREACHABLE',
          message: 'Could not establish connection with Exness content script.',
          stage: 'DISCOVERING',
          reason: 'Receiving end does not exist after retries',
          suggestedAction: 'Reload your Exness tab (my.exness.com) and click Refresh Discovery.',
        },
      });
      return;
    }

    chrome.tabs.sendMessage(targetTab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`${TAG} Error sending DISCOVER_ACCOUNTS to tab ${targetTab.id}:`, chrome.runtime.lastError.message);
        sendResponse({
          source: 'tradefourge-extension',
          type: 'ACCOUNT_LIST',
          requestId,
          version: VERSION,
          payload: [],
          error: {
            code: 'CONTENT_SCRIPT_UNREACHABLE',
            message: chrome.runtime.lastError.message,
            stage: 'DISCOVERING',
            suggestedAction: 'Reload your Exness tab and retry.',
          },
        });
        return;
      }

      console.log(`${TAG} Content Script → Background → Website | type: ACCOUNT_LIST | requestId: ${requestId} | accountsCount: ${response?.payload?.length || 0} | timestamp: ${Date.now()}`);
      sendResponse(response);
    });
    return;
  }

  // ── IMPORT_SELECTED_ACCOUNTS ──
  if (type === 'IMPORT_SELECTED_ACCOUNTS') {
    const exnessTabs = await getExnessTabs();
    console.log(`${TAG} IMPORT_SELECTED_ACCOUNTS: Found ${exnessTabs.length} Exness tab(s)`);

    if (exnessTabs.length === 0) {
      console.warn(`${TAG} FAILED: No Exness tab detected for history import.`);
      sendResponse({
        source: 'tradefourge-extension',
        type: 'IMPORT_STARTED',
        requestId,
        version: VERSION,
        payload: { stage: 'connecting', fetchedTrades: 0, totalTrades: 0, percentage: 0 },
        error: {
          code: 'EXNESS_NOT_OPEN',
          message: 'No Exness trading tab is open for history import.',
          stage: 'CONNECTING',
          suggestedAction: 'Open my.exness.com in your browser.',
        },
      });
      return;
    }

    const targetTab = exnessTabs[0];
    const accountStr = (message.payload?.accountIds || []).join(',');
    console.log(`${TAG} Background → Content Script | tabId: ${targetTab.id} | type: IMPORT_SELECTED_ACCOUNTS | requestId: ${requestId} | account: ${accountStr} | timestamp: ${Date.now()}`);

    const isReady = await ensureContentScriptReady(targetTab.id);
    if (!isReady) {
      console.error(`${TAG} FAILED: Content script on tab ${targetTab.id} unreachable for history import.`);
      sendResponse({
        source: 'tradefourge-extension',
        type: 'IMPORT_STARTED',
        requestId,
        version: VERSION,
        payload: { stage: 'connecting', fetchedTrades: 0, totalTrades: 0, percentage: 0 },
        error: {
          code: 'CONTENT_SCRIPT_UNREACHABLE',
          message: 'Could not establish connection with Exness content script.',
          stage: 'CONNECTING',
          suggestedAction: 'Reload your Exness tab and retry import.',
        },
      });
      return;
    }

    chrome.tabs.sendMessage(targetTab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`${TAG} Error sending IMPORT_SELECTED_ACCOUNTS to tab ${targetTab.id}:`, chrome.runtime.lastError.message);
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
            suggestedAction: 'Reload your Exness tab and try again.',
          },
        });
        return;
      }

      console.log(`${TAG} Content Script → Background → Website | type: IMPORT_STARTED | requestId: ${requestId} | timestamp: ${Date.now()}`);
      sendResponse(response);
    });
    return;
  }

  // ── HEARTBEAT ──
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

  // ── DEFAULT ──
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
  // External messages from web pages
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse, true);
    return true; // Keep channel open for async sendResponse
  });

  // Internal messages from content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse, false);
    return true; // Keep channel open for async sendResponse
  });

  console.log(`${TAG} Registered onMessageExternal + onMessage listeners.`);
}
