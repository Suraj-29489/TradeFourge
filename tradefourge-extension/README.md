# TradeFourge Companion Extension v1.1 — Event Pipeline & Parser Foundation

The **TradeFourge Companion Extension** is an independent Chromium extension designed as the primary real-time data bridge between broker web terminals (starting with Exness Web Terminal) and the TradeFourge platform.

Version 1.1 establishes the permanent, modular **Event Pipeline & Parser Foundation**:

```
WebSocket
   │
   ▼
Capture Layer (src/capture/websocketCapture.js)
   │
   ▼
Validation Layer (src/validation/validator.js)
   │
   ▼
Parser Layer (src/parser/*) ──► Normalization (src/models/*)
   │
   ▼
Event Dispatcher (src/events/dispatcher.js)
   ├──► Pretty Console Logger (utils/logger.js)
   ├──► Runtime State Manager (src/state/runtimeState.js)
   └──► Extension Storage Bridge (content.js) ──► Popup UI (popup.js)
```

---

## 📁 Modular Directory Structure

```
tradefourge-extension/
├── manifest.json                  # Manifest Version 3 configuration
├── background.js                 # Extension lifecycle service worker
├── content.js                    # Isolated content script (sequential pipeline injection)
├── inject.js                     # Page-context WebSocket hook (no business logic)
├── popup.html / popup.js         # Companion UI with categorized metric counters
├── styles/
│   └── popup.css                 # Dark mode UI styles
├── icons/                        # Extension branding icons
├── src/
│   ├── capture/
│   │   └── websocketCapture.js   # Capture Layer (delegates raw frames)
│   ├── validation/
│   │   └── validator.js          # Payload validation & JSON safety checks
│   ├── models/
│   │   ├── BaseEvent.js          # Base TradeFourge Event schema
│   │   ├── TickEvent.js          # Normalized Tick model (instrument, bid, ask, spread)
│   │   ├── PositionEvent.js      # Normalized Position model (ticket, volume, profit, action)
│   │   ├── OrderEvent.js         # Normalized Order model (ticket, orderType, price, state)
│   │   ├── DealEvent.js          # Normalized Deal model (dealTicket, volume, profit, swap)
│   │   └── AccountEvent.js       # Normalized Account model (balance, equity, margin)
│   ├── events/
│   │   ├── eventTypes.js         # Constant event identifiers (TICK, POSITION, ORDER, etc.)
│   │   └── dispatcher.js         # Generic Pub/Sub event dispatcher
│   ├── parser/
│   │   ├── tickParser.js         # Quote tick parser
│   │   ├── positionParser.js     # Position state parser
│   │   ├── orderParser.js        # Pending order parser
│   │   ├── dealParser.js         # Execution deal parser
│   │   ├── accountParser.js      # Balance & equity parser
│   │   └── parserManager.js      # Central parser coordinator
│   └── state/
│       └── runtimeState.js       # In-memory account & position state manager
├── utils/
│   ├── logger.js                 # Pretty structured console logger
│   ├── storage.js                # Chrome storage wrapper
│   └── validator.js              # Host domain validator
└── README.md                     # Extension technical documentation
```

---

## ⚡ Pipeline Stages

1. **Capture Layer**: Receives raw frame parameters (`direction`, `socketUrl`, `payload`, `timestamp`) directly from `inject.js`. Performs zero parsing or business logic.
2. **Validation Layer**: Filters empty, binary, or malformed ping/pong frames without throwing errors.
3. **Parser & Normalization Layer**: Specialized parsers identify event structures and normalize raw Exness payloads into consistent TradeFourge event instances (`TickEvent`, `PositionEvent`, `OrderEvent`, `DealEvent`, `AccountEvent`).
4. **Central Event Dispatcher**: Pub/Sub dispatcher (`subscribe`, `dispatch`) routes events to all subscribers.
5. **Pretty Console Logger**: Subscribes to dispatcher and outputs organized, color-coded event logs:
   ```
   [TradeFourge] Tick Event: XAUUSD (Bid: 4197.25 | Ask: 4197.47)
   [TradeFourge] Position UPDATE: Ticket #1089421 (EURUSD LONG 0.50 lots)
   [TradeFourge] Account Update: Account #849102 (Balance: 10000 USD)
   ```
6. **Runtime State Manager**: Keeps in-memory maps of open positions, pending orders, latest symbol quotes, and event counts (`totalCaptured`, `ticks`, `orders`, `deals`, `positions`, `accountUpdates`).
7. **Popup UI Integration**: Displays categorized counters populated live via storage updates.

---

## 🛠️ Verification & Development

To test the extension:
1. Open Chromium browser at `chrome://extensions`.
2. Click **Load unpacked** and select `tradefourge-extension/`.
3. Open `https://terminal.exness.com` or `https://my.exness.com`.
4. Open Developer Tools Console (`F12`) to view beautiful structured event logs.
