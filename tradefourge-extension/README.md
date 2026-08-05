# TradeFourge Companion Extension v1.2 — Runtime Intelligence Engine

The **TradeFourge Companion Extension** is an independent Chromium extension designed as the primary real-time data bridge between broker web terminals (starting with Exness Web Terminal) and the TradeFourge platform.

Version 1.2 introduces the **Runtime Intelligence Engine**, evolving the extension into an autonomous real-time trading engine that derives live analytics not provided natively by Exness.

```
Exness WebSocket
   │
   ▼
Capture & Validation Layer
   │
   ▼
Parser & Normalization Layer (TickEvent, PositionEvent, OrderEvent, DealEvent, AccountEvent)
   │
   ▼
Central Event Dispatcher ◄────────────────────────────────────────┐
   │                                                              │ (Dispatches Derived Events)
   ▼                                                              │
Runtime Intelligence Engine (src/intelligence/runtimeEngine.js) ──┘
   ├──► Spread & Velocity Tracker (metrics/spreadTracker.js)
   ├──► Floating PnL Engine (metrics/floatingPnL.js)
   ├──► Equity Intelligence (metrics/equityTracker.js)
   ├──► Drawdown Engine (metrics/drawdownTracker.js)
   ├──► Risk & Exposure Calculator (metrics/riskCalculator.js)
   ├──► Portfolio Exposure (metrics/portfolioExposure.js)
   ├──► Trade Duration Engine (metrics/tradeDuration.js)
   └──► Win Rate & Performance Tracker (metrics/performanceTracker.js)
   │
   ▼
Pretty Console Logger & Popup Subscribers
```

---

## 📁 Modular Directory Structure

```
tradefourge-extension/
├── manifest.json                  # Manifest Version 3 configuration
├── background.js                 # Extension lifecycle service worker
├── content.js                    # Content script & derived state storage bridge
├── inject.js                     # Page-context WebSocket hook (no business logic)
├── popup.html / popup.js         # Companion UI displaying live derived metrics
├── styles/
│   └── popup.css                 # Dark mode UI styles
├── icons/                        # Extension branding icons
├── src/
│   ├── capture/
│   │   └── websocketCapture.js   # Capture Layer
│   ├── validation/
│   │   └── validator.js          # Payload validation & JSON safety checks
│   ├── models/                   # Native TradeFourge Event models
│   ├── events/                   # Central Event Dispatcher & event types
│   ├── parser/                   # Specialized event parsers
│   ├── state/
│   │   └── runtimeState.js       # Live in-memory state & metrics cache
│   └── intelligence/
│       ├── derivedEvents.js      # Derived event constructors
│       ├── runtimeEngine.js      # Central Runtime Intelligence Engine
│       └── metrics/
│           ├── spreadTracker.js      # Spread & price velocity tracker
│           ├── floatingPnL.js        # Real-time unrealized PnL engine
│           ├── equityTracker.js      # Peak equity & equity milestone tracker
│           ├── drawdownTracker.js    # Drawdown ($ & %) & recovery tracker
│           ├── riskCalculator.js     # Portfolio risk % & margin usage calculator
│           ├── portfolioExposure.js  # Asset allocation & lot distribution
│           ├── tradeDuration.js      # Open trade duration timers (HH:MM:SS)
│           ├── performanceTracker.js # Win rate %, profit factor & streak engine
│           └── statistics.js         # Incremental trade statistics accumulator
├── utils/
│   ├── logger.js                 # Pretty structured console & intelligence summary logger
│   ├── storage.js                # Chrome storage wrapper
│   └── validator.js              # Host domain validator
└── README.md                     # Technical documentation
```

---

## 💡 Derived Events System

The Runtime Intelligence Engine emits new internal events dispatched via the central Pub/Sub bus:
- `SpreadChangedEvent` (symbol, current spread, average spread, velocity)
- `DrawdownChangedEvent` (drawdown amount, drawdown %, max drawdown %, recovery %)
- `ExposureChangedEvent` (total lots, margin usage %, exposure %, largest position %)
- `TradeDurationUpdatedEvent` (position ticket, duration ms, formatted `HH:MM:SS`)
- `FloatingProfitChangedEvent` (ticket, symbol, floating profit, peak profit)
- `WinRateUpdatedEvent` (win rate %, loss rate %, profit factor, streak)
- `EquityHighEvent` / `EquityLowEvent` (peak equity milestones)
- `PortfolioUpdatedEvent` (lot allocation % per instrument)

---

## 🛠️ Verification & Development

To test the extension:
1. Open Chromium browser at `chrome://extensions`.
2. Click **Load unpacked** and select `tradefourge-extension/`.
3. Open `https://terminal.exness.com` or `https://my.exness.com`.
4. Open Developer Tools Console (`F12`) to view live Runtime Intelligence summaries and structured event logs.
