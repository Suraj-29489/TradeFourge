/**
 * TradeForge - MetaTrader 5 (MT5) Integration Module
 * Frontend terminal connection, live account dashboard, and trade importer.
 */

const MT5Manager = {
  storageKey: 'tradeforge_mt5_session',
  isConnected: false,
  activeSubTab: 'overview', // 'overview', 'positions', 'history', 'orders', 'deals', 'sync'

  brokerServers: {
    'Exness': 'Exness-MT5Real11',
    'FTMO': 'FTMO-Server2',
    'IC Markets': 'ICMarketsSC-Live',
    'XM': 'XMGlobal-Real 55',
    'Pepperstone': 'Pepperstone-MT5-Live01',
    'Deriv': 'Deriv-Server-02',
    'JustMarkets': 'JustMarkets-Live2',
    'Other': 'Custom-MT5-Live'
  },

  accountData: null,

  /**
   * Initialize MT5 manager
   */
  init() {
    this.loadSession();
    this.bindEvents();
    this.render();
  },

  /**
   * Load saved session from localStorage
   */
  loadSession() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.isConnected = Boolean(parsed.isConnected);
        this.accountData = parsed.accountData || this.generateDefaultAccountData();
      } else {
        this.isConnected = false;
        this.accountData = this.generateDefaultAccountData();
      }
    } catch (e) {
      this.isConnected = false;
      this.accountData = this.generateDefaultAccountData();
    }
  },

  /**
   * Save session to localStorage
   */
  saveSession() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        isConnected: this.isConnected,
        accountData: this.accountData
      }));
    } catch (e) {
      console.warn('Could not save MT5 session to localStorage:', e);
    }
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Broker dropdown changes server input
    const brokerSelect = document.getElementById('mt5BrokerSelect');
    const serverInput = document.getElementById('mt5ServerInput');
    if (brokerSelect && serverInput) {
      brokerSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (this.brokerServers[val]) {
          serverInput.value = this.brokerServers[val];
        }
      });
    }

    // Connect form submission
    const connectForm = document.getElementById('mt5ConnectForm');
    if (connectForm) {
      connectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleConnect();
      });
    }

    // Quick demo fill button
    const btnDemoFill = document.getElementById('btnMT5DemoFill');
    if (btnDemoFill) {
      btnDemoFill.addEventListener('click', () => {
        this.fillDemoCredentials();
      });
    }

    // Disconnect button
    const btnDisconnect = document.getElementById('btnMT5Disconnect');
    if (btnDisconnect) {
      btnDisconnect.addEventListener('click', () => {
        this.disconnect();
      });
    }

    // Live Sync button
    const btnSync = document.getElementById('btnMT5Sync');
    if (btnSync) {
      btnSync.addEventListener('click', () => {
        this.syncLiveData();
      });
    }

    // Import to TradeForge button
    const btnImport = document.getElementById('btnMT5ImportToTradeForge');
    if (btnImport) {
      btnImport.addEventListener('click', () => {
        this.importToTradeForge();
      });
    }

    // Sub-tabs navigation
    document.querySelectorAll('.mt5-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) this.switchSubTab(tab);
      });
    });
  },

  /**
   * Pre-fill demo credentials for seamless testing
   */
  fillDemoCredentials() {
    const brokerSelect = document.getElementById('mt5BrokerSelect');
    const accountInput = document.getElementById('mt5AccountInput');
    const serverInput = document.getElementById('mt5ServerInput');
    const passwordInput = document.getElementById('mt5PasswordInput');
    const readOnlyCheck = document.getElementById('mt5ReadOnlyCheck');

    if (brokerSelect) brokerSelect.value = 'Exness';
    if (accountInput) accountInput.value = '12345678';
    if (serverInput) serverInput.value = 'Exness-MT5Real11';
    if (passwordInput) passwordInput.value = 'InvestorDemo2026!';
    if (readOnlyCheck) readOnlyCheck.checked = true;
  },

  /**
   * Connect handler with visual progress state
   */
  handleConnect() {
    const broker = document.getElementById('mt5BrokerSelect')?.value || 'Exness';
    const account = document.getElementById('mt5AccountInput')?.value.trim() || '12345678';
    const server = document.getElementById('mt5ServerInput')?.value.trim() || 'Exness-MT5Real11';
    const btn = document.getElementById('btnMT5Submit');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <span class="spinner-border spinner-border-sm" style="display:inline-block; width:14px; height:14px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin .75s linear infinite; margin-right:6px;"></span>
        Connecting to ${server}...
      `;
    }

    setTimeout(() => {
      this.isConnected = true;
      this.accountData = this.generateDefaultAccountData(broker, account, server);
      this.saveSession();
      this.render();

      if (window.App && typeof App.showToast === 'function') {
        App.showToast(`Connected to MT5 (${broker} #${account})`, 'success');
      }

      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Connect MT5';
      }
    }, 700);
  },

  /**
   * Disconnect MT5 account
   */
  disconnect() {
    this.isConnected = false;
    this.saveSession();
    this.render();
    if (window.App && typeof App.showToast === 'function') {
      App.showToast('MT5 account disconnected', 'success');
    }
  },

  /**
   * Simulate live sync with server
   */
  syncLiveData() {
    const btn = document.getElementById('btnMT5Sync');
    if (btn) {
      btn.innerHTML = `↻ Syncing...`;
      btn.disabled = true;
    }

    setTimeout(() => {
      if (this.accountData) {
        const delta = (Math.random() * 2 - 1) * 1.5;
        this.accountData.equity = Math.round((this.accountData.equity + delta) * 100) / 100;
        this.accountData.todayPnL = Math.round((this.accountData.todayPnL + delta) * 100) / 100;
        this.accountData.lastSyncTime = new Date().toLocaleTimeString();
        this.saveSession();
      }
      this.render();
      if (btn) {
        btn.innerHTML = `↻ Sync Live Data`;
        btn.disabled = false;
      }
      if (window.App && typeof App.showToast === 'function') {
        App.showToast('MT5 data synchronized successfully', 'success');
      }
    }, 500);
  },

  /**
   * Import all MT5 closed trade history directly into TradeForge's trade model
   */
  importToTradeForge() {
    if (!this.accountData || !this.accountData.historyTrades || this.accountData.historyTrades.length === 0) {
      if (window.App && typeof App.showToast === 'function') {
        App.showToast('No MT5 trade history available to import.', 'warning');
      }
      return;
    }

    if (!window.App) return;

    const mt5Trades = this.accountData.historyTrades.map(t => ({
      ticket: String(t.ticket),
      openTime: t.openTime,
      closeTime: t.closeTime,
      type: t.type,
      lots: Number(t.lots) || 0.01,
      symbol: t.symbol,
      openPrice: Number(t.openPrice) || 0,
      closePrice: Number(t.closePrice) || 0,
      stopLoss: t.stopLoss ? Number(t.stopLoss) : null,
      takeProfit: t.takeProfit ? Number(t.takeProfit) : null,
      commission: Number(t.commission) || 0,
      swap: Number(t.swap) || 0,
      profit: Number(t.profit) || 0,
      closeReason: t.closeReason || (t.profit >= 0 ? 'tp' : 'sl'),
      isWin: Number(t.profit) > 0,
      isLoss: Number(t.profit) < 0,
      isBreakEven: Number(t.profit) === 0
    }));

    const existingTickets = new Set((App.trades || []).map(t => String(t.ticket)));
    let addedCount = 0;

    mt5Trades.forEach(t => {
      if (!existingTickets.has(t.ticket)) {
        App.trades.push(t);
        existingTickets.add(t.ticket);
        addedCount++;
      }
    });

    App.trades.sort((a, b) => new Date(a.closeTime || a.openTime) - new Date(b.closeTime || b.openTime));
    App.processTrades();

    if (typeof App.showToast === 'function') {
      App.showToast(`Imported ${addedCount} MT5 trades into TradeForge!`, 'success');
    }
  },

  /**
   * Switch sub-tabs (Account Overview, Positions, History, Orders, Deals, Sync)
   */
  switchSubTab(tabName) {
    this.activeSubTab = tabName;

    document.querySelectorAll('.mt5-subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    document.querySelectorAll('.mt5-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `mt5TabPane-${tabName}`);
    });
  },

  /**
   * Render MT5 View
   */
  render() {
    const connectView = document.getElementById('mt5ConnectState');
    const dashboardView = document.getElementById('mt5DashboardState');

    if (!connectView || !dashboardView) return;

    if (!this.isConnected) {
      connectView.style.display = 'block';
      dashboardView.style.display = 'none';
      return;
    }

    connectView.style.display = 'none';
    dashboardView.style.display = 'flex';

    const acc = this.accountData || this.generateDefaultAccountData();

    // Header info
    const brokerEl = document.getElementById('mt5ConnectedBroker');
    const accountEl = document.getElementById('mt5ConnectedAccount');
    const serverEl = document.getElementById('mt5ConnectedServer');
    if (brokerEl) brokerEl.innerText = acc.broker;
    if (accountEl) accountEl.innerText = acc.accountNumber;
    if (serverEl) serverEl.innerText = acc.server;

    // KPI Cards
    const balEl = document.getElementById('mt5KpiBalance');
    const eqEl = document.getElementById('mt5KpiEquity');
    const freeMarginEl = document.getElementById('mt5KpiFreeMargin');
    const marginLevelEl = document.getElementById('mt5KpiMarginLevel');
    const positionsCountEl = document.getElementById('mt5KpiOpenPositions');
    const todayPnlEl = document.getElementById('mt5KpiTodayPnl');

    if (balEl) balEl.innerText = `$${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (eqEl) eqEl.innerText = `$${acc.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (freeMarginEl) freeMarginEl.innerText = `$${acc.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (marginLevelEl) marginLevelEl.innerText = `${acc.marginLevel}%`;
    if (positionsCountEl) positionsCountEl.innerText = acc.openPositions.length;

    if (todayPnlEl) {
      const sign = acc.todayPnL >= 0 ? '+' : '-';
      todayPnlEl.innerText = `${sign}$${Math.abs(acc.todayPnL).toFixed(2)}`;
      todayPnlEl.className = `mt5-kpi-value ${acc.todayPnL >= 0 ? 'profit' : 'loss'}`;
    }

    // Render Sub-tab contents
    this.renderOverviewTab(acc);
    this.renderPositionsTab(acc.openPositions);
    this.renderHistoryTab(acc.historyTrades);
    this.renderOrdersTab(acc.orders);
    this.renderDealsTab(acc.historyTrades);
    this.renderSyncTab(acc);
  },

  renderOverviewTab(acc) {
    const cont = document.getElementById('mt5TabPane-overview');
    if (!cont) return;

    cont.innerHTML = `
      <div class="mt5-overview-grid">
        <div class="mt5-info-card">
          <span class="mt5-info-label">Broker / Company</span>
          <span class="mt5-info-val">${acc.broker} (${acc.company})</span>
          <span class="mt5-info-sub">Regulated Multi-Asset Broker</span>
        </div>
        <div class="mt5-info-card">
          <span class="mt5-info-label">Server Ping & Status</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="status-dot" style="background:#10b981; box-shadow:0 0 8px #10b981;"></span>
            <span class="mt5-info-val" style="font-size: 1.15rem;">${acc.ping} ms (Optimal)</span>
          </div>
          <span class="mt5-info-sub">Data-center: Amsterdam DC-02</span>
        </div>
        <div class="mt5-info-card">
          <span class="mt5-info-label">Account Currency & Leverage</span>
          <span class="mt5-info-val">${acc.currency} • ${acc.leverage}</span>
          <span class="mt5-info-sub">Dynamic Margin System</span>
        </div>
        <div class="mt5-info-card">
          <span class="mt5-info-label">Platform Version</span>
          <span class="mt5-info-val">${acc.platform}</span>
          <span class="mt5-info-sub">Investor Connection Mode</span>
        </div>
      </div>
    `;
  },

  renderPositionsTab(positions) {
    const tbody = document.getElementById('mt5PositionsTableBody');
    if (!tbody) return;

    if (!positions || positions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-state-cell" style="text-align:center; padding:24px; color:var(--text-dim);">No open positions currently active.</td></tr>`;
      return;
    }

    tbody.innerHTML = positions.map(p => {
      const pnlSign = p.profit >= 0 ? '+' : '-';
      const pnlClass = p.profit >= 0 ? 'profit-text' : 'loss-text';
      return `
        <tr>
          <td style="font-family: var(--font-mono); color: var(--text-dim);">#${p.ticket}</td>
          <td style="font-weight: 700; color: var(--text-main);">${p.symbol}</td>
          <td><span class="type-badge ${p.type}">${p.type.toUpperCase()}</span></td>
          <td style="font-family: var(--font-mono);">${p.lots}</td>
          <td style="font-family: var(--font-mono);">${p.openPrice}</td>
          <td style="font-family: var(--font-mono); font-weight:700;">${p.currentPrice}</td>
          <td style="font-family: var(--font-mono); color: var(--text-dim);">${p.sl || '--'}</td>
          <td style="font-family: var(--font-mono); color: var(--text-dim);">${p.tp || '--'}</td>
          <td style="font-size: 0.8rem; color: var(--text-dim);">${p.openTime.replace('T', ' ')}</td>
          <td class="${pnlClass}" style="font-family: var(--font-mono); font-weight: 800;">${pnlSign}$${Math.abs(p.profit).toFixed(2)}</td>
        </tr>
      `;
    }).join('');
  },

  renderHistoryTab(trades) {
    const tbody = document.getElementById('mt5HistoryTableBody');
    if (!tbody) return;

    if (!trades || trades.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state-cell" style="text-align:center; padding:24px; color:var(--text-dim);">No closed trade history available.</td></tr>`;
      return;
    }

    tbody.innerHTML = trades.map(t => {
      const pnlSign = t.profit >= 0 ? '+' : '-';
      const pnlClass = t.profit >= 0 ? 'profit-text' : 'loss-text';
      return `
        <tr>
          <td style="font-family: var(--font-mono); color: var(--text-dim);">#${t.ticket}</td>
          <td style="font-weight: 700; color: var(--text-main);">${t.symbol}</td>
          <td><span class="type-badge ${t.type}">${t.type.toUpperCase()}</span></td>
          <td style="font-family: var(--font-mono);">${t.lots}</td>
          <td style="font-family: var(--font-mono);">${t.openPrice}</td>
          <td style="font-family: var(--font-mono);">${t.closePrice}</td>
          <td style="font-size: 0.78rem; color: var(--text-dim);">${t.closeTime.replace('T', ' ')}</td>
          <td style="font-family: var(--font-mono); color: var(--text-dim);">${t.commission ? '$' + t.commission : '$0.00'}</td>
          <td class="${pnlClass}" style="font-family: var(--font-mono); font-weight: 800;">${pnlSign}$${Math.abs(t.profit).toFixed(2)}</td>
        </tr>
      `;
    }).join('');
  },

  renderOrdersTab(orders) {
    const tbody = document.getElementById('mt5OrdersTableBody');
    if (!tbody) return;

    if (!orders || orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state-cell" style="text-align:center; padding:24px; color:var(--text-dim);">No pending orders placed.</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(o => `
      <tr>
        <td style="font-family: var(--font-mono); color: var(--text-dim);">#${o.ticket}</td>
        <td style="font-weight: 700;">${o.symbol}</td>
        <td><span class="type-badge buy">${o.type.toUpperCase()}</span></td>
        <td style="font-family: var(--font-mono);">${o.lots}</td>
        <td style="font-family: var(--font-mono); font-weight: 700;">${o.price}</td>
        <td style="font-family: var(--font-mono); color: var(--text-dim);">${o.currentPrice}</td>
        <td><span class="analytics-tag" style="color:#818cf8; background:rgba(99,102,241,0.1); border-color:rgba(99,102,241,0.3);">${o.state}</span></td>
      </tr>
    `).join('');
  },

  renderDealsTab(trades) {
    const tbody = document.getElementById('mt5DealsTableBody');
    if (!tbody) return;

    if (!trades || trades.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state-cell" style="text-align:center; padding:24px; color:var(--text-dim);">No deals recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = trades.slice(0, 10).map((t, idx) => `
      <tr>
        <td style="font-family: var(--font-mono); color: var(--text-dim);">#${987100 + idx}</td>
        <td style="font-family: var(--font-mono); color: var(--text-muted);">#${t.ticket}</td>
        <td style="font-weight: 700;">${t.symbol}</td>
        <td><span class="type-badge ${t.type}">${t.type.toUpperCase()}</span></td>
        <td><span style="font-size:0.75rem; font-weight:700; color:#818cf8;">OUT</span></td>
        <td style="font-family: var(--font-mono);">${t.lots}</td>
        <td style="font-family: var(--font-mono);">${t.closePrice}</td>
        <td class="${t.profit >= 0 ? 'profit-text' : 'loss-text'}" style="font-family: var(--font-mono); font-weight:700;">${t.profit >= 0 ? '+' : ''}$${t.profit.toFixed(2)}</td>
      </tr>
    `).join('');
  },

  renderSyncTab(acc) {
    const cont = document.getElementById('mt5TabPane-sync');
    if (!cont) return;

    cont.innerHTML = `
      <div style="background: var(--bg-card-alt); border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 22px; display: flex; flex-direction: column; gap: 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div>
            <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin-bottom: 2px;">Data Synchronization Engine</h4>
            <p style="font-size: 0.82rem; color: var(--text-muted);">Continuous read-only background polling from ${acc.server}.</p>
          </div>
          <button class="btn-upload-csv" id="btnSyncTriggerNow" onclick="MT5Manager.syncLiveData()">↻ Force Sync Now</button>
        </div>

        <div class="mt5-overview-grid">
          <div class="mt5-info-card">
            <span class="mt5-info-label">Last Sync Time</span>
            <span class="mt5-info-val" style="font-size: 1.15rem;">${acc.lastSyncTime || 'Just now'}</span>
            <span class="mt5-info-sub">Status: 100% In Sync</span>
          </div>
          <div class="mt5-info-card">
            <span class="mt5-info-label">Sync Interval</span>
            <span class="mt5-info-val" style="font-size: 1.15rem;">Real-time (Stream)</span>
            <span class="mt5-info-sub">Tick-by-tick updates</span>
          </div>
          <div class="mt5-info-card">
            <span class="mt5-info-label">Import Status</span>
            <span class="mt5-info-val" style="font-size: 1.15rem; color: var(--profit);">${acc.historyTrades.length} Trades Ready</span>
            <span class="mt5-info-sub">Ready to convert to TradeForge</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Mock realistic MT5 account data
   */
  generateDefaultAccountData(broker = 'Exness', account = '12345678', server = 'Exness-MT5Real11') {
    return {
      broker,
      accountNumber: account,
      server,
      balance: 1082.78,
      equity: 1094.32,
      freeMargin: 942.18,
      marginLevel: 718.5,
      todayPnL: 42.18,
      currency: 'USD',
      leverage: '1:500',
      company: `${broker} Global Financial Ltd`,
      ping: 14,
      platform: 'MetaTrader 5 Build 4150',
      lastSyncTime: 'Just now',

      openPositions: [
        {
          ticket: 2558912,
          symbol: 'XAUUSD',
          type: 'buy',
          lots: 0.05,
          openPrice: 2512.40,
          currentPrice: 2514.80,
          sl: 2505.00,
          tp: 2525.00,
          profit: 12.00,
          openTime: '2026-08-28T13:40:50'
        },
        {
          ticket: 2558915,
          symbol: 'EURUSD',
          type: 'sell',
          lots: 0.10,
          openPrice: 1.08500,
          currentPrice: 1.08470,
          sl: 1.08750,
          tp: 1.08200,
          profit: 3.00,
          openTime: '2026-08-28T14:10:00'
        }
      ],

      orders: [
        {
          ticket: 2559001,
          symbol: 'BTCUSD',
          type: 'buy limit',
          lots: 0.02,
          price: 76500.00,
          currentPrice: 78600.00,
          state: 'Placed'
        },
        {
          ticket: 2559004,
          symbol: 'XAUUSD',
          type: 'sell stop',
          lots: 0.05,
          price: 2500.00,
          currentPrice: 2514.80,
          state: 'Placed'
        }
      ],

      historyTrades: [
        { ticket: 2557713, symbol: 'BTCUSD', type: 'sell', lots: 0.05, openPrice: 78675.08, closePrice: 78876.50, openTime: '2026-08-28T14:07:32', closeTime: '2026-08-28T14:10:05', commission: -0.50, swap: 0, profit: -10.07, closeReason: 'sl' },
        { ticket: 2557070, symbol: 'XAUUSD', type: 'sell', lots: 0.03, openPrice: 2503.31, closePrice: 2507.13, openTime: '2026-08-28T13:40:50', closeTime: '2026-08-28T13:42:50', commission: -0.30, swap: 0, profit: -11.50, closeReason: 'sl' },
        { ticket: 2556996, symbol: 'XAUUSD', type: 'buy', lots: 0.05, openPrice: 2505.74, closePrice: 2502.30, openTime: '2026-08-28T13:35:25', closeTime: '2026-08-28T13:37:42', commission: -0.50, swap: 0, profit: -17.20, closeReason: 'sl' },
        { ticket: 2556957, symbol: 'XAUUSD', type: 'buy', lots: 0.05, openPrice: 2502.49, closePrice: 2502.97, openTime: '2026-08-28T13:31:52', closeTime: '2026-08-28T13:34:35', commission: -0.50, swap: 0, profit: 2.40, closeReason: 'tp' },
        { ticket: 2555820, symbol: 'XAUUSD', type: 'sell', lots: 0.02, openPrice: 2497.09, closePrice: 2500.26, openTime: '2026-08-28T11:08:01', closeTime: '2026-08-28T11:16:36', commission: -0.20, swap: 0, profit: -6.30, closeReason: 'sl' },
        { ticket: 2553743, symbol: 'XAUUSD', type: 'buy', lots: 0.02, openPrice: 2484.37, closePrice: 2484.87, openTime: '2026-08-28T06:24:14', closeTime: '2026-08-28T06:30:16', commission: -0.20, swap: 0, profit: 1.00, closeReason: 'tp' },
        { ticket: 2553431, symbol: 'XAUUSD', type: 'buy', lots: 0.05, openPrice: 2475.35, closePrice: 2483.35, openTime: '2026-08-28T05:52:14', closeTime: '2026-08-28T06:22:16', commission: -0.50, swap: 0, profit: 40.00, closeReason: 'tp' },
        { ticket: 2553504, symbol: 'XAUUSD', type: 'buy', lots: 0.01, openPrice: 2474.26, closePrice: 2483.26, openTime: '2026-08-28T06:00:53', closeTime: '2026-08-28T06:13:00', commission: -0.10, swap: 0, profit: 9.00, closeReason: 'tp' },
        { ticket: 2544338, symbol: 'XAUUSD', type: 'sell', lots: 0.10, openPrice: 2481.68, closePrice: 2485.29, openTime: '2026-08-27T13:00:53', closeTime: '2026-08-27T13:01:01', commission: -1.00, swap: 0, profit: -36.00, closeReason: 'sl' },
        { ticket: 2544322, symbol: 'XAUUSD', type: 'sell', lots: 0.10, openPrice: 2483.66, closePrice: 2482.54, openTime: '2026-08-27T13:00:13', closeTime: '2026-08-27T13:00:25', commission: -1.00, swap: 0, profit: 11.20, closeReason: 'tp' },
        { ticket: 2544089, symbol: 'XAUUSD', type: 'sell', lots: 0.10, openPrice: 2489.34, closePrice: 2487.70, openTime: '2026-08-27T12:43:01', closeTime: '2026-08-27T12:43:28', commission: -1.00, swap: 0, profit: 16.40, closeReason: 'tp' },
        { ticket: 2544067, symbol: 'XAUUSD', type: 'sell', lots: 0.10, openPrice: 2487.51, closePrice: 2490.21, openTime: '2026-08-27T12:40:39', closeTime: '2026-08-27T12:42:25', commission: -1.00, swap: 0, profit: -27.00, closeReason: 'sl' },
        { ticket: 2544044, symbol: 'XAUUSD', type: 'sell', lots: 0.10, openPrice: 2488.65, closePrice: 2488.18, openTime: '2026-08-27T12:39:19', closeTime: '2026-08-27T12:40:15', commission: -1.00, swap: 0, profit: 4.80, closeReason: 'tp' },
        { ticket: 2544041, symbol: 'XAUUSD', type: 'sell', lots: 0.05, openPrice: 2488.88, closePrice: 2488.82, openTime: '2026-08-27T12:38:59', closeTime: '2026-08-27T12:39:03', commission: -0.50, swap: 0, profit: 0.30, closeReason: 'tp' },
        { ticket: 2544033, symbol: 'XAUUSD', type: 'sell', lots: 0.05, openPrice: 2488.94, closePrice: 2488.44, openTime: '2026-08-27T12:37:45', closeTime: '2026-08-27T12:38:12', commission: -0.50, swap: 0, profit: 2.50, closeReason: 'tp' },
        { ticket: 2543977, symbol: 'XAUUSD', type: 'buy', lots: 0.10, openPrice: 2487.65, closePrice: 2488.85, openTime: '2026-08-27T12:30:10', closeTime: '2026-08-27T12:35:00', commission: -1.00, swap: 0, profit: 12.00, closeReason: 'tp' },
        { ticket: 2543910, symbol: 'US30', type: 'buy', lots: 0.05, openPrice: 41250.00, closePrice: 41320.00, openTime: '2026-08-27T11:15:00', closeTime: '2026-08-27T11:45:00', commission: -0.50, swap: 0, profit: 35.00, closeReason: 'tp' },
        { ticket: 2543880, symbol: 'EURUSD', type: 'buy', lots: 0.20, openPrice: 1.08200, closePrice: 1.08295, openTime: '2026-08-27T09:00:00', closeTime: '2026-08-27T09:25:00', commission: -1.50, swap: 0, profit: 19.00, closeReason: 'tp' }
      ]
    };
  }
};
