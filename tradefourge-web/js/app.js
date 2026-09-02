/**
 * TradeForge - Main Application Controller
 */

const App = {
  trades: [],
  filteredTrades: [],
  currentMetrics: null,
  activeView: 'dashboard',
  dateFilter: 'all', // 'all', 'last30', 'august2026', 'july2026'

  // Trade Log Table state
  tradeLogState: {
    search: '',
    symbol: 'all',
    type: 'all',
    outcome: 'all',
    sortField: 'closeTime',
    sortAsc: false,
    currentPage: 1,
    pageSize: 15
  },

  /**
   * Application Initialization
   */
  async init() {
    this.bindEvents();
    if (window.BacktestEngine) {
      BacktestEngine.init();
    }
    StorageManager.resetForNewSession();
    this.loadNotesAndRules();
    this.trades = [];
    this.processTrades();
  },

  /**
   * Process & filter trades and update all UI components
   */
  processTrades() {
    this.applyDateFilter();
    this.currentMetrics = TradeAnalytics.calculateMetrics(this.filteredTrades);

    this.updateHeaderInfo();
    this.updateKPICards();
    ChartManager.updateDashboardCharts(this.currentMetrics);
    CalendarManager.init(this.currentMetrics);
    this.renderRecentTradesTable();
    this.renderTradeLogTable();
    this.renderReportsView();
    this.renderInsightsView();
    this.renderStrategiesView();
    this.updateStorageIndicator();
  },

  /**
   * Date Filter application
   */
  applyDateFilter() {
    if (this.dateFilter === 'all') {
      this.filteredTrades = [...this.trades];
    } else if (this.dateFilter === 'last30') {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      this.filteredTrades = this.trades.filter(t => new Date(t.closeTime || t.openTime) >= cutoff);
    } else if (this.dateFilter === 'august2026') {
      this.filteredTrades = this.trades.filter(t => (t.closeTime || t.openTime || '').startsWith('2026-08'));
    } else if (this.dateFilter === 'july2026') {
      this.filteredTrades = this.trades.filter(t => (t.closeTime || t.openTime || '').startsWith('2026-07'));
    } else {
      this.filteredTrades = [...this.trades];
    }
  },

  /**
   * Update top navigation bar import info and date label
   */
  updateHeaderInfo() {
    const dateFilterBtnText = document.getElementById('dateFilterBtnText');
    if (dateFilterBtnText && this.currentMetrics.firstTradeDate && this.currentMetrics.lastTradeDate) {
      dateFilterBtnText.innerText = `${this.formatDateShort(this.currentMetrics.firstTradeDate)} - ${this.formatDateShort(this.currentMetrics.lastTradeDate)}`;
    }
  },

  formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  /**
   * Update Top KPI Cards
   */
  updateKPICards() {
    const m = this.currentMetrics;

    // Total P&L
    const totalPnlEl = document.getElementById('kpiTotalPnL');
    if (totalPnlEl) {
      totalPnlEl.innerText = TradeAnalytics.formatCurrency(m.totalPnL);
      totalPnlEl.className = `kpi-value ${m.totalPnL >= 0 ? 'profit' : 'loss'}`;
    }

    const tradesCountEl = document.getElementById('kpiTotalTradesCount');
    if (tradesCountEl) {
      tradesCountEl.innerText = `Trades in total: ${m.totalTrades}`;
    }

    // Profit Factor
    const pfEl = document.getElementById('kpiProfitFactor');
    if (pfEl) {
      pfEl.innerText = m.profitFactor.toFixed(2);
    }
    const pfDeltaEl = document.getElementById('kpiProfitFactorDelta');
    if (pfDeltaEl) {
      pfDeltaEl.innerHTML = m.profitFactor >= 1.0 
        ? `<span class="delta-pos">▲ Healthy (>1.0)</span>`
        : `<span class="delta-neg">▼ Needs adjustment (<1.0)</span>`;
    }

    // Average Winning Trade
    const avgWinEl = document.getElementById('kpiAvgWin');
    if (avgWinEl) {
      avgWinEl.innerText = TradeAnalytics.formatCurrency(m.avgWin);
      avgWinEl.className = 'kpi-value profit';
    }
    const avgWinSubEl = document.getElementById('kpiAvgWinSub');
    if (avgWinSubEl) {
      avgWinSubEl.innerHTML = `<span class="delta-pos">▲ ${m.winnersCount} winning trades</span>`;
    }

    // Average Losing Trade
    const avgLossEl = document.getElementById('kpiAvgLoss');
    if (avgLossEl) {
      avgLossEl.innerText = TradeAnalytics.formatCurrency(m.avgLoss, false);
      avgLossEl.className = 'kpi-value loss';
    }
    const avgLossSubEl = document.getElementById('kpiAvgLossSub');
    if (avgLossSubEl) {
      avgLossSubEl.innerHTML = `<span class="delta-neg">▼ ${m.losersCount} losing trades</span>`;
    }

    // Update Donut legend counts
    const winnersCountEl = document.getElementById('donutWinnersCount');
    if (winnersCountEl) winnersCountEl.innerText = `${m.winnersCount} winners`;

    const losersCountEl = document.getElementById('donutLosersCount');
    if (losersCountEl) losersCountEl.innerText = `${m.losersCount} losers`;

    const winningDaysCountEl = document.getElementById('donutWinningDaysCount');
    if (winningDaysCountEl) winningDaysCountEl.innerText = `${m.winningDaysCount} winners`;

    const losingDaysCountEl = document.getElementById('donutLosingDaysCount');
    if (losingDaysCountEl) losingDaysCountEl.innerText = `${m.losingDaysCount} losers`;
  },

  /**
   * Render Recent Trades Table on Dashboard
   */
  renderRecentTradesTable() {
    const tbody = document.getElementById('recentTradesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const recent = [...this.filteredTrades].reverse().slice(0, 7);

    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 24px;">No trade data available</td></tr>`;
      return;
    }

    recent.forEach(trade => {
      const tr = document.createElement('tr');
      const dateFormatted = trade.closeTime ? trade.closeTime.replace('T', ' ').slice(0, 16) : trade.openTime.replace('T', ' ').slice(0, 16);
      const pnlFormatted = TradeAnalytics.formatCurrency(trade.profit);
      const pnlClass = trade.profit > 0 ? 'profit-text' : (trade.profit < 0 ? 'loss-text' : 'neutral-text');

      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 0.78rem;">${dateFormatted}</td>
        <td><span class="symbol-badge">${trade.symbol}</span></td>
        <td>${trade.lots}</td>
        <td><span class="type-badge ${trade.type}">${trade.type.toUpperCase()}</span></td>
        <td class="${pnlClass}">${pnlFormatted}</td>
      `;

      tr.addEventListener('click', () => this.openTradeDetailModal(trade));
      tbody.appendChild(tr);
    });
  },

  /**
   * Render Trade Log Full Table with filtering, search & pagination
   */
  renderTradeLogTable() {
    const tbody = document.getElementById('tradeLogTableBody');
    if (!tbody) return;

    let trades = [...this.filteredTrades];
    const { search, symbol, type, outcome, sortField, sortAsc, currentPage, pageSize } = this.tradeLogState;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      trades = trades.filter(t => 
        t.symbol.toLowerCase().includes(q) || 
        t.ticket.toLowerCase().includes(q) ||
        (t.closeReason && t.closeReason.toLowerCase().includes(q))
      );
    }

    // Symbol filter
    if (symbol !== 'all') {
      trades = trades.filter(t => t.symbol === symbol);
    }

    // Type filter
    if (type !== 'all') {
      trades = trades.filter(t => t.type === type);
    }

    // Outcome filter
    if (outcome === 'win') {
      trades = trades.filter(t => t.profit > 0);
    } else if (outcome === 'loss') {
      trades = trades.filter(t => t.profit < 0);
    }

    // Sorting
    trades.sort((a, b) => {
      let v1 = a[sortField];
      let v2 = b[sortField];
      if (typeof v1 === 'string') {
        return sortAsc ? v1.localeCompare(v2) : v2.localeCompare(v1);
      }
      return sortAsc ? (v1 - v2) : (v2 - v1);
    });

    // Populate Symbol dropdown options if needed
    const symbolSelect = document.getElementById('tradeLogSymbolFilter');
    if (symbolSelect && symbolSelect.children.length <= 1) {
      const distinctSymbols = [...new Set(this.trades.map(t => t.symbol))].sort();
      distinctSymbols.forEach(sym => {
        const opt = document.createElement('option');
        opt.value = sym;
        opt.innerText = sym;
        symbolSelect.appendChild(opt);
      });
    }

    // Pagination
    const totalRecords = trades.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const startIdx = (currentPage - 1) * pageSize;
    const paginated = trades.slice(startIdx, startIdx + pageSize);

    tbody.innerHTML = '';

    if (paginated.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-dim); padding: 32px;">No matching trades found.</td></tr>`;
      return;
    }

    paginated.forEach(trade => {
      const tr = document.createElement('tr');
      const openTimeFmt = trade.openTime ? trade.openTime.replace('T', ' ').slice(0, 16) : '-';
      const closeTimeFmt = trade.closeTime ? trade.closeTime.replace('T', ' ').slice(0, 16) : '-';
      const pnlFormatted = TradeAnalytics.formatCurrency(trade.profit);
      const pnlClass = trade.profit > 0 ? 'profit-text' : (trade.profit < 0 ? 'loss-text' : 'neutral-text');

      tr.innerHTML = `
        <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-dim);">${trade.ticket}</td>
        <td><span class="symbol-badge">${trade.symbol}</span></td>
        <td><span class="type-badge ${trade.type}">${trade.type.toUpperCase()}</span></td>
        <td>${trade.lots}</td>
        <td>${trade.openPrice || '-'}</td>
        <td>${trade.closePrice || '-'}</td>
        <td style="font-size: 0.78rem; color: var(--text-muted);">${openTimeFmt}</td>
        <td style="font-size: 0.78rem; color: var(--text-muted);">${closeTimeFmt}</td>
        <td class="${pnlClass}">${pnlFormatted}</td>
        <td><button class="btn-sample" style="padding: 3px 8px; font-size: 0.72rem;">View</button></td>
      `;

      tr.addEventListener('click', () => this.openTradeDetailModal(trade));
      tbody.appendChild(tr);
    });

    // Update pagination indicators
    const pageInfoEl = document.getElementById('tradeLogPageInfo');
    if (pageInfoEl) {
      pageInfoEl.innerText = `Showing ${startIdx + 1}-${Math.min(startIdx + pageSize, totalRecords)} of ${totalRecords} trades`;
    }
  },

  /**
   * Render Reports View
   */
  renderReportsView() {
    ChartManager.renderReportsCharts(this.currentMetrics);

    const container = document.getElementById('reportsSymbolList');
    if (!container) return;

    container.innerHTML = '';
    const symbols = this.currentMetrics.symbolBreakdown || [];

    symbols.forEach(s => {
      const row = document.createElement('div');
      row.className = 'legend-item';
      row.style.marginBottom = '6px';
      const winRate = s.trades > 0 ? ((s.wins / s.trades) * 100).toFixed(1) : 0;
      const pnlFormatted = TradeAnalytics.formatCurrency(s.pnl);
      const pnlColor = s.pnl >= 0 ? 'var(--profit)' : 'var(--loss)';

      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="symbol-badge">${s.symbol}</span>
          <span style="font-size: 0.8rem; color: var(--text-dim);">${s.trades} trades (${winRate}% win)</span>
        </div>
        <div style="font-weight: 700; color: ${pnlColor}; font-size: 0.9rem;">
          ${pnlFormatted}
        </div>
      `;
      container.appendChild(row);
    });
  },

  /**
   * Render Insights View
   */
  renderInsightsView() {
    const m = this.currentMetrics;
    if (!m || m.totalTrades === 0) return;

    // Best symbol
    const bestSymbol = m.symbolBreakdown.length > 0 ? m.symbolBreakdown[0] : null;
    const bestSymEl = document.getElementById('insightBestSymbol');
    if (bestSymEl && bestSymbol) {
      bestSymEl.innerText = `${bestSymbol.symbol} (${TradeAnalytics.formatCurrency(bestSymbol.pnl)})`;
    }

    // Long vs Short Win rate
    const buys = m.typeBreakdown.buy;
    const sells = m.typeBreakdown.sell;
    const buyWinRate = buys.count > 0 ? ((buys.wins / buys.count) * 100).toFixed(1) : 0;
    const sellWinRate = sells.count > 0 ? ((sells.wins / sells.count) * 100).toFixed(1) : 0;

    const longShortEl = document.getElementById('insightLongShort');
    if (longShortEl) {
      longShortEl.innerText = `Long: ${buyWinRate}% | Short: ${sellWinRate}%`;
    }

    // Best Day
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDayIdx = 1;
    let bestDayPnL = -Infinity;
    for (let i = 0; i < 7; i++) {
      if (m.weekdayMap[i] > bestDayPnL) {
        bestDayPnL = m.weekdayMap[i];
        bestDayIdx = i;
      }
    }
    const bestDayEl = document.getElementById('insightBestDay');
    if (bestDayEl) {
      bestDayEl.innerText = `${dayNames[bestDayIdx]} (${TradeAnalytics.formatCurrency(bestDayPnL)})`;
    }
  },

  /**
   * Render Strategies View
   */
  renderStrategiesView() {
    const container = document.getElementById('strategiesListContainer');
    if (!container) return;
    container.innerHTML = '';

    const strategies = [
      { name: 'XAUUSD Breakout Strategy', symbol: 'XAUUSD', trades: 70, winrate: '54.2%', pnl: '+$342.10', status: 'Profitable' },
      { name: 'BTCUSD Trend Momentum', symbol: 'BTCUSD', trades: 18, winrate: '61.1%', pnl: '+$94.80', status: 'Profitable' },
      { name: 'Major FX Mean Reversion', symbol: 'EURUSD', trades: 11, winrate: '45.4%', pnl: '-$180.54', status: 'Reviewing' }
    ];

    strategies.forEach(st => {
      const card = document.createElement('div');
      card.className = 'kpi-card';
      card.innerHTML = `
        <div class="kpi-card-header">
          <span style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${st.name}</span>
          <span class="symbol-badge">${st.symbol}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 0.84rem;">
          <span style="color: var(--text-dim);">Winrate: <strong style="color: var(--text-main);">${st.winrate}</strong></span>
          <span style="color: var(--text-dim);">Trades: <strong style="color: var(--text-main);">${st.trades}</strong></span>
          <span style="color: ${st.pnl.startsWith('+') ? 'var(--profit)' : 'var(--loss)'}; font-weight: 700;">${st.pnl}</span>
        </div>
      `;
      container.appendChild(card);
    });
  },

  /**
   * Update Storage Status in Sidebar
   */
  updateStorageIndicator() {
    const el = document.getElementById('storageStatusText');
    if (el) {
      el.innerText = this.trades.length ? `${this.trades.length} trades in this session` : 'No trades loaded';
    }
  },

  /**
   * Open Trade Detail Modal
   */
  openTradeDetailModal(trade) {
    const modal = document.getElementById('tradeDetailModal');
    const content = document.getElementById('tradeDetailBody');
    if (!modal || !content) return;

    const pnlFormatted = TradeAnalytics.formatCurrency(trade.profit);
    const pnlColor = trade.profit >= 0 ? 'var(--profit)' : 'var(--loss)';

    content.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid var(--border-light); margin-bottom: 14px;">
        <div>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main);">${trade.symbol} <span class="type-badge ${trade.type}">${trade.type.toUpperCase()}</span></h3>
          <p style="font-size: 0.8rem; color: var(--text-dim); font-family: var(--font-mono);">Ticket: #${trade.ticket}</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.5rem; font-weight: 700; color: ${pnlColor};">${pnlFormatted}</div>
          <span style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase;">Realized Net P&L</span>
        </div>
      </div>

      <div class="trade-detail-grid">
        <div class="trade-detail-item">
          <span class="trade-detail-label">Position Volume</span>
          <span class="trade-detail-value">${trade.lots} Lots</span>
        </div>
        <div class="trade-detail-item">
          <span class="trade-detail-label">Close Reason</span>
          <span class="trade-detail-value">${trade.closeReason || 'User Closed'}</span>
        </div>
        <div class="trade-detail-item">
          <span class="trade-detail-label">Entry Price</span>
          <span class="trade-detail-value">${trade.openPrice || '-'}</span>
        </div>
        <div class="trade-detail-item">
          <span class="trade-detail-label">Exit Price</span>
          <span class="trade-detail-value">${trade.closePrice || '-'}</span>
        </div>
        <div class="trade-detail-item">
          <span class="trade-detail-label">Stop Loss (SL)</span>
          <span class="trade-detail-value">${trade.stopLoss || 'None'}</span>
        </div>
        <div class="trade-detail-item">
          <span class="trade-detail-label">Take Profit (TP)</span>
          <span class="trade-detail-value">${trade.takeProfit || 'None'}</span>
        </div>
        <div class="trade-detail-item" style="grid-column: 1 / -1;">
          <span class="trade-detail-label">Opening Time (UTC)</span>
          <span class="trade-detail-value" style="font-size: 0.85rem;">${trade.openTime ? trade.openTime.replace('T', ' ') : '-'}</span>
        </div>
        <div class="trade-detail-item" style="grid-column: 1 / -1;">
          <span class="trade-detail-label">Closing Time (UTC)</span>
          <span class="trade-detail-value" style="font-size: 0.85rem;">${trade.closeTime ? trade.closeTime.replace('T', ' ') : '-'}</span>
        </div>
      </div>
    `;

    modal.classList.add('active');
  },

  /**
   * Open Day Trades Modal when clicking a calendar cell
   */
  openDayTradesModal(dateKey, dayData) {
    const modal = document.getElementById('dayTradesModal');
    const title = document.getElementById('dayTradesModalTitle');
    const body = document.getElementById('dayTradesModalBody');
    if (!modal || !body) return;

    title.innerText = `Trades on ${dateKey} (${TradeAnalytics.formatCurrency(dayData.pnl)})`;

    let html = `
      <table class="trade-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Symbol</th>
            <th>Type</th>
            <th>Lots</th>
            <th>P/L ($)</th>
          </tr>
        </thead>
        <tbody>
    `;

    dayData.tradeList.forEach(t => {
      const timeOnly = (t.closeTime || t.openTime || '').slice(11, 16);
      const pnlFormatted = TradeAnalytics.formatCurrency(t.profit);
      const pnlClass = t.profit > 0 ? 'profit-text' : (t.profit < 0 ? 'loss-text' : 'neutral-text');

      html += `
        <tr onclick="App.openTradeDetailModal(${JSON.stringify(t).replace(/"/g, '&quot;')})">
          <td style="color: var(--text-dim);">${timeOnly}</td>
          <td><span class="symbol-badge">${t.symbol}</span></td>
          <td><span class="type-badge ${t.type}">${t.type.toUpperCase()}</span></td>
          <td>${t.lots}</td>
          <td class="${pnlClass}">${pnlFormatted}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    body.innerHTML = html;
    modal.classList.add('active');
  },

  /**
   * Load Saved Notes & Rules
   */
  loadNotesAndRules() {
    const notesEl = document.getElementById('notebookTextarea');
    if (notesEl) {
      notesEl.value = StorageManager.getNotes();
      notesEl.addEventListener('input', (e) => {
        StorageManager.saveNotes(e.target.value);
      });
    }

    const rulesListEl = document.getElementById('rulesListContainer');
    if (rulesListEl) {
      const rules = StorageManager.getRules();
      rulesListEl.innerHTML = '';
      rules.forEach(rule => {
        const item = document.createElement('label');
        item.className = 'rule-item';
        item.innerHTML = `
          <input type="checkbox" ${rule.checked ? 'checked' : ''} data-id="${rule.id}">
          <span style="font-size: 0.85rem; color: var(--text-main);">${rule.text}</span>
        `;
        item.querySelector('input').addEventListener('change', (e) => {
          rule.checked = e.target.checked;
          StorageManager.saveRules(rules);
        });
        rulesListEl.appendChild(item);
      });
    }
  },

  /**
   * Switch Navigation View
   */
  switchView(viewName) {
    this.activeView = viewName;

    // Update sidebar nav buttons
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-view') === viewName);
    });

    // Update view sections
    document.querySelectorAll('.view-section').forEach(el => {
      el.classList.toggle('active', el.id === `view-${viewName}`);
    });

    // Update Header title
    const titleMap = {
      dashboard: 'Dashboard',
      journal: 'Daily Journal',
      tradelog: 'Trade Log',
      backtesting: 'Backtesting',
      reports: 'Reports & Performance',
      insights: 'AI & Rule Insights',
      strategies: 'Strategies',
      notebook: 'Trader Notebook'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.innerText = titleMap[viewName] || 'Dashboard';

    // If switching to reports, re-render charts to fit container
    if (viewName === 'reports') {
      this.renderReportsView();
    }
  },

  /**
   * Display modern toast notification
   */
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer') || document.body;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span style="font-size: 1.1rem;">${type === 'success' ? '✓' : '⚠'}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  },

  /**
   * Bind DOM Event Listeners
   */
  bindEvents() {
    // Navigation items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const view = item.getAttribute('data-view');
        if (view) this.switchView(view);
      });
    });

    // Sidebar collapse & reveal toggle via brand logo
    const brandToggleBtn = document.getElementById('sidebarBrandToggle');
    const revealBtn = document.getElementById('sidebarRevealBtn');
    const setSidebarCollapsed = (collapsed) => {
      document.body.classList.toggle('sidebar-collapsed', collapsed);
    };
    if (brandToggleBtn) {
      brandToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        setSidebarCollapsed(true);
      });
    }
    if (revealBtn) {
      revealBtn.addEventListener('click', (e) => {
        e.preventDefault();
        setSidebarCollapsed(false);
      });
    }

    // Main P&L Chart Tabs (Cumulative vs Daily)
    const tabCum = document.getElementById('tabCumPnL');
    const tabDaily = document.getElementById('tabDailyPnL');
    if (tabCum && tabDaily) {
      tabCum.addEventListener('click', () => {
        tabCum.classList.add('active');
        tabDaily.classList.remove('active');
        ChartManager.currentPnLView = 'cumulative';
        ChartManager.renderMainPnLChart(this.currentMetrics);
      });
      tabDaily.addEventListener('click', () => {
        tabDaily.classList.add('active');
        tabCum.classList.remove('active');
        ChartManager.currentPnLView = 'daily';
        ChartManager.renderMainPnLChart(this.currentMetrics);
      });
    }

    // Calendar Navigation
    const prevMonthBtn = document.getElementById('calPrevBtn');
    const nextMonthBtn = document.getElementById('calNextBtn');
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => CalendarManager.prevMonth());
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => CalendarManager.nextMonth());

    // Export JSON Button
    const exportJsonBtn = document.getElementById('btnExportJSONTop');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => this.exportJSON());
    }

    // CSV Upload Modals trigger
    const uploadBtnTop = document.getElementById('btnUploadCSVTop');
    const uploadModal = document.getElementById('uploadModal');
    const fileInput = document.getElementById('csvFileInput');
    const dropzone = document.getElementById('csvDropzone');

    const openUploadModal = () => {
      if (uploadModal) uploadModal.classList.add('active');
    };

    if (uploadBtnTop) uploadBtnTop.addEventListener('click', openUploadModal);

    // Close Modals
    document.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
      });
    });

    // File Input & Dropzone handling
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleCSVFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleCSVFile(e.target.files[0]);
        }
      });
    }

    // Clear Data Button
    const clearDataBtn = document.getElementById('btnClearData');
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all stored trade data?')) {
          StorageManager.clearAll();
          this.trades = [];
          this.processTrades();
          this.showToast('All trade records cleared.', 'error');
        }
      });
    }

    // Add Trade Modal
    const addTradeBtn = document.getElementById('btnAddTradeSidebar');
    const addTradeModal = document.getElementById('addTradeModal');
    const addTradeForm = document.getElementById('addTradeForm');

    if (addTradeBtn && addTradeModal) {
      addTradeBtn.addEventListener('click', () => addTradeModal.classList.add('active'));
    }

    if (addTradeForm) {
      addTradeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newTrade = {
          ticket: `M-${Date.now().toString().slice(-6)}`,
          openTime: document.getElementById('formOpenTime').value || new Date().toISOString(),
          closeTime: document.getElementById('formCloseTime').value || new Date().toISOString(),
          symbol: (document.getElementById('formSymbol').value || 'XAUUSD').toUpperCase().trim(),
          type: document.getElementById('formType').value || 'buy',
          lots: parseFloat(document.getElementById('formLots').value) || 0.01,
          openPrice: parseFloat(document.getElementById('formOpenPrice').value) || 0,
          closePrice: parseFloat(document.getElementById('formClosePrice').value) || 0,
          stopLoss: parseFloat(document.getElementById('formStopLoss').value) || null,
          takeProfit: parseFloat(document.getElementById('formTakeProfit').value) || null,
          profit: parseFloat(document.getElementById('formProfit').value) || 0,
          closeReason: document.getElementById('formCloseReason').value || 'user'
        };

        this.trades = StorageManager.addTrade(newTrade);
        this.processTrades();
        addTradeModal.classList.remove('active');
        addTradeForm.reset();
        this.showToast('Manual trade added successfully!', 'success');
      });
    }

    // Date Range Presets Dropdown
    const dateSelect = document.getElementById('headerDateRangeSelect');
    if (dateSelect) {
      dateSelect.addEventListener('change', (e) => {
        this.dateFilter = e.target.value;
        this.processTrades();
      });
    }

    // Trade Log Table Search & Filters
    const logSearch = document.getElementById('tradeLogSearch');
    if (logSearch) {
      logSearch.addEventListener('input', (e) => {
        this.tradeLogState.search = e.target.value;
        this.tradeLogState.currentPage = 1;
        this.renderTradeLogTable();
      });
    }

    const logSymFilter = document.getElementById('tradeLogSymbolFilter');
    if (logSymFilter) {
      logSymFilter.addEventListener('change', (e) => {
        this.tradeLogState.symbol = e.target.value;
        this.tradeLogState.currentPage = 1;
        this.renderTradeLogTable();
      });
    }

    const logTypeFilter = document.getElementById('tradeLogTypeFilter');
    if (logTypeFilter) {
      logTypeFilter.addEventListener('change', (e) => {
        this.tradeLogState.type = e.target.value;
        this.tradeLogState.currentPage = 1;
        this.renderTradeLogTable();
      });
    }

    const logOutcomeFilter = document.getElementById('tradeLogOutcomeFilter');
    if (logOutcomeFilter) {
      logOutcomeFilter.addEventListener('change', (e) => {
        this.tradeLogState.outcome = e.target.value;
        this.tradeLogState.currentPage = 1;
        this.renderTradeLogTable();
      });
    }

    // Trade Log Pagination Prev / Next
    const prevPageBtn = document.getElementById('tradeLogPrevPage');
    const nextPageBtn = document.getElementById('tradeLogNextPage');
    if (prevPageBtn && nextPageBtn) {
      prevPageBtn.addEventListener('click', () => {
        if (this.tradeLogState.currentPage > 1) {
          this.tradeLogState.currentPage--;
          this.renderTradeLogTable();
        }
      });
      nextPageBtn.addEventListener('click', () => {
        const total = this.filteredTrades.length;
        const maxPage = Math.ceil(total / this.tradeLogState.pageSize);
        if (this.tradeLogState.currentPage < maxPage) {
          this.tradeLogState.currentPage++;
          this.renderTradeLogTable();
        }
      });
    }
  },

  /**
   * Export trade log data as a downloadable JSON file
   */
  exportJSON() {
    const tradesToExport = (this.trades && this.trades.length > 0) ? this.trades : StorageManager.getTrades();
    if (!tradesToExport || tradesToExport.length === 0) {
      this.showToast('No trades found in Trade Log to export.', 'error');
      return;
    }

    const dataStr = JSON.stringify(tradesToExport, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    link.download = `tradeforge_trades_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    this.showToast(`Exported ${tradesToExport.length} trades to JSON!`, 'success');
  },

  /**
   * Handle CSV File from upload input or dropzone
   */
  handleCSVFile(file) {
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsedTrades = TradeParser.parseCSV(text);
        StorageManager.saveTrades(parsedTrades, file.name);
        this.trades = parsedTrades;
        this.processTrades();

        const uploadModal = document.getElementById('uploadModal');
        if (uploadModal) uploadModal.classList.remove('active');

        this.showToast(`Imported ${parsedTrades.length} trades from ${file.name}!`, 'success');
      } catch (err) {
        console.error(err);
        this.showToast(err.message || 'Failed to parse CSV file', 'error');
      }
    };

    reader.onerror = () => {
      this.showToast('Error reading the selected file.', 'error');
    };

    reader.readAsText(file);
  }
};

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
