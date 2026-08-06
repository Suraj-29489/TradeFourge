/**
 * TradeFourge Companion Extension v3.4 — Background Service Worker
 * Fully instrumented Manifest V3 cross-tab messaging pipeline.
 *
 * Message flow:
 *   Website → chrome.runtime.sendMessage(extensionId, msg)
 *     → onMessageExternal listener (this file)
 *       → For PING: respond directly with PONG
 *       → For DISCOVER_ACCOUNTS / IMPORT: forward to Exness content script via chrome.tabs.sendMessage
 *         → Content script responds → background forwards response → website callback
 *   Content Script (Exness) → chrome.runtime.sendMessage(pushEvent)
 *     → onMessage listener (this file)
 *       → background forwards to all TradeFourge tabs via chrome.tabs.sendMessage
 */

const VERSION = '3.4.0';
const TAG = '[TradeFourge Background]';

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
          'https://tradefourge.vercel.app/*'
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

async function forwardToTradeFourgeTabs(message) {
  const tfTabs = await getTradeFourgeTabs();
  console.log(`${TAG} Forwarding push event ${message.type} to ${tfTabs.length} TradeFourge tabs`);
  tfTabs.forEach((tab) => {
    chrome.tabs.sendMessage(tab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn(`${TAG} Could not deliver message to TF tab ${tab.id}:`, chrome.runtime.lastError.message);
      }
    });
  });
}

// ─── Message Handler ────────────────────────────────────────────────────────

async function handleMessage(message, sender, sendResponse, isExternal) {
  const type = message?.type || 'UNKNOWN';
  const senderOrigin = sender?.url || sender?.origin || sender?.tab?.url || 'unknown';
  const senderType = isExternal ? 'EXTERNAL (website)' : 'INTERNAL (content script)';

  console.log(`${TAG} ────────────────────────────────────────`);
  console.log(`${TAG} Received: ${type}`);
  console.log(`${TAG} Source: ${senderType}`);
  console.log(`${TAG} Origin: ${senderOrigin}`);
  console.log(`${TAG} Extension ID: ${chrome.runtime.id}`);
  console.log(`${TAG} Request ID: ${message?.requestId || 'none'}`);

  // If this is an internal push event from the content script, forward to TradeFourge website tabs
  if (!isExternal && message.isPushEvent) {
    console.log(`${TAG} Processing PUSH event from Exness content script...`);
    await forwardToTradeFourgeTabs(message);
    sendResponse({ success: true });
    return;
  }

  // ── PING / GET_EXTENSION_INFO ──
  if (type === 'PING' || type === 'GET_EXTENSION_INFO') {
    const exnessTabs = await getExnessTabs();
    console.log(`${TAG} Found ${exnessTabs.length} active Exness tab(s)`);

    const pongResponse = {
      source: 'tradefourge-extension',
      type: 'PONG',
      requestId: message.requestId || `pong_${Date.now()}`,
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

    console.log(`${TAG} Sending PONG → Website`);
    console.log(`${TAG} ────────────────────────────────────────`);
    sendResponse(pongResponse);
    return;
  }

  // ── DISCOVER_ACCOUNTS ──
  if (type === 'DISCOVER_ACCOUNTS') {
    const exnessTabs = await getExnessTabs();
    console.log(`${TAG} DISCOVER_ACCOUNTS: Found ${exnessTabs.length} Exness tab(s)`);

    if (exnessTabs.length > 0) {
      const targetTab = exnessTabs[0];
      console.log(`${TAG} Forwarding DISCOVER_ACCOUNTS → Exness Content Script (Tab ID: ${targetTab.id}, URL: ${targetTab.url})`);

      chrome.tabs.sendMessage(targetTab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          console.error(`${TAG} Error forwarding to content script:`, chrome.runtime.lastError.message);
          sendResponse({
            source: 'tradefourge-extension',
            type: 'ACCOUNT_LIST',
            requestId: message.requestId,
            version: VERSION,
            payload: [],
            error: { code: 'EXNESS_NOT_OPEN', message: chrome.runtime.lastError.message },
          });
          return;
        }
        console.log(`${TAG} Received ACCOUNT_LIST from Exness Content Script. Forwarding → Website`);
        sendResponse(response || {
          source: 'tradefourge-extension',
          type: 'ACCOUNT_LIST',
          requestId: message.requestId,
          version: VERSION,
          payload: [],
        });
      });
      return;
    }

    // No Exness tabs — respond with empty or demo data
    console.log(`${TAG} No Exness tabs open. Returning empty account list.`);
    sendResponse({
      source: 'tradefourge-extension',
      type: 'ACCOUNT_LIST',
      requestId: message.requestId,
      version: VERSION,
      payload: [],
    });
    return;
  }

  // ── IMPORT_SELECTED_ACCOUNTS ──
  if (type === 'IMPORT_SELECTED_ACCOUNTS') {
    const exnessTabs = await getExnessTabs();
    console.log(`${TAG} IMPORT_SELECTED_ACCOUNTS: Found ${exnessTabs.length} Exness tab(s)`);

    if (exnessTabs.length > 0) {
      const targetTab = exnessTabs[0];
      console.log(`${TAG} Forwarding IMPORT_SELECTED_ACCOUNTS → Exness Content Script (Tab ID: ${targetTab.id})`);

      chrome.tabs.sendMessage(targetTab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          console.error(`${TAG} Error forwarding to content script:`, chrome.runtime.lastError.message);
          sendResponse({
            source: 'tradefourge-extension',
            type: 'IMPORT_STARTED',
            requestId: message.requestId,
            version: VERSION,
            payload: { stage: 'error', fetchedTrades: 0, totalTrades: 0, percentage: 0 },
            error: { code: 'IMPORT_FAILED', message: chrome.runtime.lastError.message },
          });
          return;
        }
        console.log(`${TAG} Received IMPORT response from Content Script. Forwarding → Website`);
        sendResponse(response);
      });
      return;
    }

    console.log(`${TAG} No Exness tabs open. Cannot import.`);
    sendResponse({
      source: 'tradefourge-extension',
      type: 'IMPORT_STARTED',
      requestId: message.requestId,
      version: VERSION,
      payload: { stage: 'error', fetchedTrades: 0, totalTrades: 0, percentage: 0 },
      error: { code: 'EXNESS_NOT_OPEN', message: 'No Exness tab is open. Please log into Exness first.' },
    });
    return;
  }

  // ── HEARTBEAT ──
  if (type === 'HEARTBEAT') {
    console.log(`${TAG} HEARTBEAT received. Responding alive.`);
    sendResponse({
      source: 'tradefourge-extension',
      type: 'PONG',
      requestId: message.requestId,
      version: VERSION,
      payload: { status: 'alive', latency: 0 },
    });
    return;
  }

  // ── DEFAULT ──
  console.log(`${TAG} Unhandled message type: ${type}. Sending generic PONG.`);
  sendResponse({
    source: 'tradefourge-extension',
    type: 'PONG',
    requestId: message.requestId,
    version: VERSION,
    payload: { isInstalled: true, status: 'active' },
  });
}

// ─── Listener Registration ──────────────────────────────────────────────────

if (typeof chrome !== 'undefined' && chrome.runtime) {
  // External messages from web pages (via externally_connectable)
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse, true);
    return true; // Keep sendResponse channel open for async
  });

  // Internal messages from content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse, false);
    return true; // Keep sendResponse channel open for async
  });

  console.log(`${TAG} Listeners registered: onMessageExternal + onMessage`);
}
