# 🚀 TradeFourge - Professional Trading Journal & AI Analytics Dashboard

TradeFourge is a fast, clean, and modern trading journal frontend inspired by TradeZella, featuring a built-in AI strategy assistant (Fourge AI) powered by Google's Gemini.

## ✨ Key Features

- **🧠 Fourge AI (Gemini Integration)**:
  - Built-in AI strategy bot directly in your trading dashboard.
  - **Multi-Model Support**: Dynamically switch between `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, and `gemini-3.5-flash`.
  - **Robust Auto-Failover**: Smart retry and model failover mechanics if quotas are hit (e.g., HTTP 429/503 limits).
  - **Offline Strategy Engine**: Built-in fallback that processes trading intent and offline queries instantly when no connection is available.
  - **Real-Time Global Token Tracker**: Live, server-side usage telemetry tracking input/output tokens dynamically directly in the AI header.

- **📁 Advanced CSV Import & Exness Support**:
  - Drag-and-drop file dropzone.
  - **Intelligent Parser**: Supports MetaTrader 4/5, cTrader, Tradovate, Prop Firm exports, and specialized support for **Exness** (including seamless handling of partial closes and complex trade lifecycles).

- **📊 Comprehensive KPI Metrics**:
  - Total Net P&L (colored dynamically with trades count).
  - Profit Factor, Average Winning/Losing Trade.
  - Win Rate % by Trades & Win Rate % by Days.

- **📈 Interactive Dynamic Charts (Chart.js)**:
  - Daily Net Cumulative P&L (smooth equity curve area chart).
  - Net Daily P&L & Win Rate Donut Charts.
  - Instrument & Day of Week Breakdown.

- **📅 Monthly Trading Calendar Heatmap**:
  - Interactive monthly calendar with daily P&L and trade counts.
  - Color-coded cells mapping out profitable and losing days visually.

- **📜 Filterable & Sortable Trade Log**:
  - Search by ticket, symbol, or close reason.
  - Filter by Symbol, Direction (Buy/Sell), and Outcome.

## 🛠️ Tech Stack

- **Frontend**: HTML5, Modern CSS3 (Variables, Flexbox, Grid, Glassmorphism).
- **Scripting**: Pure Vanilla JavaScript (ES6+ modular architecture).
- **Backend/AI**: Node.js / Vercel Serverless (for Gemini API Proxy & Telemetry) and Local Direct API Fallbacks.
- **Charts**: Chart.js v4.
- **Storage**: Browser LocalStorage API & `data/usage.json` for global telemetry.

## 🚀 Getting Started

Simply clone the repository and open `index.html` in any modern web browser, or serve it locally:

```bash
# Clone the repository
git clone https://github.com/Suraj-29489/TradeFourge.git

# Navigate to directory
cd TradeFourge

# Open in browser directly, or serve with Python for local telemetry features:
python3 -m http.server 8000
```

Open your browser at `http://localhost:8000`.

## 📂 Project Structure

- `index.html` - Main application single-page interface
- `css/` - Styling, layout, and component themes
- `js/` - Core logic, storage, parsers, and offline/online AI engines (`strategy-bot.js`)
- `api/` - Serverless Node.js endpoints for secure Gemini proxy and token tracking
- `tradefourge-web/` - Web deployment ready version

## 📄 License

MIT License. Designed with ❤️ for traders.
