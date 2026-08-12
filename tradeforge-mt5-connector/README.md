# TradeForge MetaTrader 5 Companion Connector (v1.0.0)

A lightweight, secure, **read-only** desktop application that synchronizes MetaTrader 5 trading accounts, live positions, and closed trade history to TradeForge for advanced journaling, AI coaching, and analytics.

---

## ⚠️ READ-ONLY GUARANTEE

The TradeForge MT5 Connector is **NOT** a trading bot, EA, signal generator, or order executor.
- It **NEVER** executes trades (`order_send`, `buy`, `sell`).
- It **NEVER** modifies stop loss (SL) or take profit (TP).
- It **NEVER** closes positions.
- It **NEVER** requests or stores your MetaTrader 5 trading passwords.

Its sole purpose is reading closed trade history and live open positions to power your TradeForge journal.

---

## 📥 End-User Standalone Installation (No Python Required)

Normal users do **NOT** need to install Python, pip, or virtual environments.

### Step 1: MetaTrader 5 Setup
1. Install MetaTrader 5 on your Windows PC (if not already installed).
2. Open MetaTrader 5 and log into your trading account.

### Step 2: Download & Run Installer
1. Download `TradeForgeMT5Connector-Setup-1.0.0.exe`.
2. Double-click the installer and follow the setup wizard.
3. Launch **TradeForge MT5 Connector** from your Desktop or Start Menu.

### Step 3: Pair Connector
1. Open the TradeForge web application (`https://tradefourge.com/mt5/settings`).
2. Generate a **Pairing Code** (e.g. `8F72-K29P`).
3. Enter your TradeForge email and pairing code in the connector desktop app.
4. Click **[ Pair Connector with TradeForge ]**.

### Step 4: Done!
The connector runs quietly in your system tray, synchronizing live positions every 2 seconds and closed trades every 5 minutes.

---

## 💻 GUI & CLI Diagnostic Commands

### Desktop GUI Launcher
Double-click `TradeForgeMT5Connector.exe` or run:
```bash
TradeForgeMT5Connector.exe --gui
```

### Diagnostic Doctor (`doctor`)
Runs system diagnostic checks on MT5 terminal, account login, credentials, and API reachability:
```bash
TradeForgeMT5Connector.exe doctor
```

### Status Check (`status`)
Displays connector state, MT5 terminal liveness, account login details, and last sync timestamps:
```bash
TradeForgeMT5Connector.exe status
```

---

## 🔧 Developer Build & Packaging Instructions

Developers building from source can run the automated Windows release builder:

```bash
# 1. Activate virtual environment
.\venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 3. Run unit test suite
python -m unittest discover -s tests -p "test_*.py" -v

# 4. Build standalone Windows executable & SHA256 checksums
python scripts/build_windows.py

# 5. Run release validation scanner
python scripts/validate_release.py
```

Generated build output:
- `dist/TradeForgeMT5Connector.exe`
- `dist/SHA256SUMS.txt`

---

## 🔒 Security & Privacy Architecture

- **Credentials**: TradeForge API keys are stored in Windows Credential Manager.
- **Log Privacy**: Secret scrubbing filter automatically redacts API keys and Bearer tokens from `connector.log`.
- **AppData Storage**: Local SQLite database and rotated logs are stored in user-writable `%LOCALAPPDATA%\TradeForge\MT5Connector\`.
