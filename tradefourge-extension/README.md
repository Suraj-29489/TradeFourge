# TradeFourge Companion Extension v1.0 — Foundation & WebSocket Discovery

The **TradeFourge Companion Extension** is an independent Chromium extension designed as the primary real-time data bridge between broker web terminals (starting with Exness Web Terminal) and the TradeFourge platform.

Phase 1 focuses on building a safe, non-intrusive foundation that intercepts and logs incoming and outgoing WebSocket traffic from Exness Web Terminal without altering packet timing, blocking data, or modifying payload content.

---

## 📁 Project Structure

```
tradefourge-extension/
├── manifest.json         # Manifest Version 3 configuration
├── background.js        # Extension lifecycle service worker (no business logic)
├── content.js           # Isolated content script (page injection & storage bridge)
├── inject.js            # Page-context injected script (Main World WebSocket hook)
├── popup.html           # Companion extension UI HTML
├── popup.js             # Companion extension UI logic
├── styles/
│   └── popup.css        # Sleek dark mode glassmorphism UI styles
├── icons/               # Extension branding icons (16x16, 48x48, 128x128)
├── utils/
│   ├── logger.js        # Unified logging utility (INFO, WARN, ERROR, DEBUG)
│   ├── storage.js       # Chrome storage wrapper
│   └── validator.js     # Exness domain validator
├── services/
│   ├── ws-interceptor.js   # WebSocket interception core
│   └── http-interceptor.js # HTTP fetch/XHR hook template (disabled for v1)
├── types/
│   └── index.d.ts       # TypeScript interface definitions
└── README.md            # Technical documentation
```

---

## 🛠️ Manifest Configuration (V3)

- **`manifest_version`**: `3`
- **Permissions**: Minimal required permission (`"storage"`).
- **Match Patterns**: Strictly activates on `https://terminal.exness.*/*` and `https://my.exness.*/*`.
- **Web Accessible Resources**: Exposes `inject.js` so `content.js` can safely append it to the page DOM.

---

## 💉 Injection Architecture & Flow

### Why `inject.js` Exists
Chromium extension architecture isolates content scripts inside an **Isolated World**. Content scripts can inspect DOM elements but **cannot** access or override window objects (such as `window.WebSocket`, `window.fetch`, or `window.XMLHttpRequest`) created by the web page's scripts.

To intercept real-time WebSocket traffic, the hook must execute inside the **Main World** (the webpage's global `window` context). `inject.js` is dynamically injected as a script tag into the DOM at `document_start`.

```
┌───────────────────────────────────────────────────────────┐
│                      Target Webpage                       │
│                                                           │
│   ┌─────────────────────┐       ┌─────────────────────┐   │
│   │     Main World      │       │   Isolated World    │   │
│   │     (inject.js)     │       │    (content.js)     │   │
│   └──────────┬──────────┘       └──────────┬──────────┘   │
│              │                             │              │
│              │ window.postMessage          │              │
│              └────────────────────────────►│              │
│                                            │              │
└────────────────────────────────────────────┼──────────────┘
                                             │ chrome.storage
                                             ▼
                                  ┌────────────────────┐
                                  │   background.js    │
                                  │    & popup.js      │
                                  └────────────────────┘
```

### Key Differences: `content.js` vs `inject.js`

| Feature | `content.js` | `inject.js` |
|---|---|---|
| **Execution Environment** | Isolated World | Main World (Page Context) |
| **`window` Access** | Extension Isolated Window | Actual Webpage `window` |
| **DOM Access** | Full Read/Write | Full Read/Write |
| **Native API Override** | Cannot override page `WebSocket` | Can override page `WebSocket` |
| **Extension API Access** | Has access to `chrome.runtime`, `chrome.storage` | No access to `chrome.*` APIs |

---

## ⚡ How WebSocket Interception Works

1. **Initialization Guard**: Ensures single initialization per page session using `window.__TRADEFOURGE_INJECTED__` and `document.documentElement.dataset.tradefourgeInjected`.
2. **Prototype & Constant Preservation**: Wraps `window.WebSocket` constructor while preserving prototype chains and static status codes (`CONNECTING`, `OPEN`, `CLOSING`, `CLOSED`).
3. **Outgoing Interception**: Overrides `instance.send` to log outgoing frame data and measure byte payload size.
4. **Incoming Interception**: Hooks both `instance.addEventListener('message', ...)` and `Object.defineProperty(instance, 'onmessage', ...)` to intercept incoming frame events.
5. **Zero Side-Effects**: All logging and postMessage execution are wrapped in defensive `try-catch` blocks. The interceptor never alters data, blocks packets, or introduces latency.

---

## 🖥️ Log Output Format

Incoming WebSocket Message:
```
[TradeFourge Extension]

Incoming WebSocket Message

Timestamp: 2026-08-05T18:25:00.000Z
Socket URL: wss://terminal.exness.com/ws
Direction: INCOMING
Payload Size: 128 bytes
Raw Payload: <message>
```

Outgoing WebSocket Message:
```
[TradeFourge Extension]

Outgoing WebSocket Message

Timestamp: 2026-08-05T18:25:01.000Z
Socket URL: wss://terminal.exness.com/ws
Direction: OUTGOING
Payload Size: 64 bytes
Raw Payload: <message>
```

---

## ⚠️ Current Limitations (v1.0)

- **Observation Only**: No trade parsing or database syncing in v1.
- **Exness Only**: Domain filtering activates only on `terminal.exness.*` and `my.exness.*`.
- **HTTP Interception Disabled**: `fetch()` and `XMLHttpRequest` hooks are implemented in template files but disabled for v1.

---

## 🚀 Future Roadmap

1. **v1.1 — Protocol Parser Engine**: Parse binary/JSON Exness WebSocket frames into structured quote and trade events.
2. **v1.2 — Multi-Broker Adapter Layer**: Add adapter modules for TradingView, Deriv, and Binance Web Terminals.
3. **v1.3 — Offline Event Queue & Cache**: Store intercepted trades in `IndexedDB` when offline.
4. **v2.0 — Live Sync API Bridge**: Secure API synchronization with TradeFourge Backend via JWT authentication.
