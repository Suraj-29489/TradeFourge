/**
 * TradeForge - Main Application Controller
 */

const App = {
  trades: [],
  filteredTrades: [],
  currentMetrics: null,
  activeView: 'dashboard',
  dateFilter: 'all', // 'all', 'last30', 'custom'
  customStartDate: '',
  customEndDate: '',
  customRangeSelectionStep: 0,
  miniCalYear: new Date().getFullYear(),
  miniCalMonth: new Date().getMonth(),
  _miniCalInitialized: false,

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
    this.initPWA();
    if (window.BacktestEngine) {
      BacktestEngine.init();
    }
    if (window.MT5Manager) {
      MT5Manager.init();
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
    this.updateCustomDateBounds();
    this.updateKPICards();
    ChartManager.updateDashboardCharts(this.currentMetrics);
    CalendarManager.init(this.currentMetrics);
    this.renderRecentTradesTable();
    this.renderTradeLogTable();
    this.renderReportsView();
    this.renderAnalyticsView();
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
      const { maxDate } = this.getAvailableDateRange();
      const baseDate = maxDate ? new Date(maxDate + 'T23:59:59Z') : new Date();
      const cutoff = new Date(baseDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      this.filteredTrades = this.trades.filter(t => {
        const dStr = (t.closeTime || t.openTime || '').slice(0, 10);
        return dStr && dStr >= cutoffStr;
      });
    } else if (this.dateFilter === 'custom') {
      const start = this.customStartDate;
      const end = this.customEndDate;
      this.filteredTrades = this.trades.filter(t => {
        const dStr = (t.closeTime || t.openTime || '').slice(0, 10);
        if (!dStr) return false;
        if (start && dStr < start) return false;
        if (end && dStr > end) return false;
        return true;
      });
    } else {
      this.filteredTrades = [...this.trades];
    }
  },

  /**
   * Determine available date boundaries according to present CSV trade data
   */
  getAvailableDateRange() {
    if (!this.trades || this.trades.length === 0) {
      return { minDate: '', maxDate: '' };
    }
    let minDate = null;
    let maxDate = null;
    this.trades.forEach(t => {
      const dStr = (t.closeTime || t.openTime || '').slice(0, 10);
      if (dStr && dStr.length === 10) {
        if (!minDate || dStr < minDate) minDate = dStr;
        if (!maxDate || dStr > maxDate) maxDate = dStr;
      }
    });
    return { minDate: minDate || '', maxDate: maxDate || '' };
  },

  /**
   * Update date bounds and mini-calendar according to CSV data
   */
  updateCustomDateBounds() {
    const { minDate, maxDate } = this.getAvailableDateRange();
    const startInput = document.getElementById('customStartDate');
    const endInput = document.getElementById('customEndDate');
    const infoEl = document.getElementById('customRangeInfo');

    if (minDate && maxDate) {
      if (startInput) {
        startInput.min = minDate;
        startInput.max = maxDate;
        if (!this.customStartDate) {
          startInput.value = minDate;
          this.customStartDate = minDate;
        }
      }
      if (endInput) {
        endInput.min = minDate;
        endInput.max = maxDate;
        if (!this.customEndDate) {
          endInput.value = maxDate;
          this.customEndDate = maxDate;
        }
      }
      if (infoEl) {
        if (this.customRangeSelectionStep === 1 && this.customStartDate) {
          infoEl.innerHTML = `<span style="color: var(--primary); font-weight: 700;">Start: ${this.formatDateShort(this.customStartDate)}</span> — Now click End Date`;
        } else {
          infoEl.innerHTML = `Available: ${this.formatDateShort(minDate)} → ${this.formatDateShort(maxDate)} <br><span style="color: var(--text-muted); font-size: 0.72rem;">Click start date, then end date to apply</span>`;
        }
      }

      if (!this._miniCalInitialized) {
        const parts = maxDate.split('-').map(Number);
        if (parts.length >= 2) {
          this.miniCalYear = parts[0];
          this.miniCalMonth = parts[1] - 1;
          this._miniCalInitialized = true;
        }
      }
    } else {
      if (infoEl) infoEl.innerText = 'No trade data loaded in CSV yet';
    }
    this.renderMiniCalendar();
  },

  /**
   * Render Mini Calendar inside custom date popover
   */
  renderMiniCalendar() {
    const grid = document.getElementById('miniCalGrid');
    const title = document.getElementById('miniCalTitle');
    if (!grid || !title) return;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    title.innerText = `${monthNames[this.miniCalMonth]} ${this.miniCalYear}`;
    grid.innerHTML = '';

    const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    dayHeaders.forEach(d => {
      const th = document.createElement('div');
      th.className = 'mini-cal-weekday';
      th.innerText = d;
      grid.appendChild(th);
    });

    const { minDate, maxDate } = this.getAvailableDateRange();
    const firstDay = new Date(this.miniCalYear, this.miniCalMonth, 1).getDay();
    const daysInMonth = new Date(this.miniCalYear, this.miniCalMonth + 1, 0).getDate();
    const prevMonthDays = new Date(this.miniCalYear, this.miniCalMonth, 0).getDate();

    const startVal = this.customStartDate;
    const endVal = this.customEndDate;

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      const pad = document.createElement('div');
      pad.className = 'mini-cal-day disabled other-month';
      pad.innerText = prevMonthDays - i;
      grid.appendChild(pad);
    }

    // Days in current month
    const mStr = String(this.miniCalMonth + 1).padStart(2, '0');
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = String(day).padStart(2, '0');
      const dateKey = `${this.miniCalYear}-${mStr}-${dStr}`;
      const cell = document.createElement('div');
      cell.className = 'mini-cal-day';
      cell.innerText = day;

      const isAvailable = (!minDate || dateKey >= minDate) && (!maxDate || dateKey <= maxDate);

      if (!isAvailable) {
        cell.classList.add('disabled');
      } else {
        if (dateKey === startVal || dateKey === endVal) {
          cell.classList.add('endpoint');
        } else if (startVal && endVal && dateKey > startVal && dateKey < endVal) {
          cell.classList.add('in-range');
        }

        // Show trade presence dot if day has trades
        if (this.currentMetrics && this.currentMetrics.dailyMap && this.currentMetrics.dailyMap[dateKey]) {
          cell.classList.add('has-trades');
        }

        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleMiniCalDayClick(dateKey);
        });
      }

      grid.appendChild(cell);
    }

    // Next month padding to complete grid row
    const totalCells = firstDay + daysInMonth;
    const remaining = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
    for (let j = 1; j <= remaining; j++) {
      const pad = document.createElement('div');
      pad.className = 'mini-cal-day disabled other-month';
      pad.innerText = j;
      grid.appendChild(pad);
    }
  },

  /**
   * Handle day clicking in the mini calendar (2-click range flow)
   */
  handleMiniCalDayClick(dateKey) {
    const startInput = document.getElementById('customStartDate');
    const endInput = document.getElementById('customEndDate');
    const infoEl = document.getElementById('customRangeInfo');

    if (this.customRangeSelectionStep === 0 || !this.customStartDate) {
      // Step 1: Start date selected
      this.customStartDate = dateKey;
      this.customEndDate = '';
      this.customRangeSelectionStep = 1;

      if (startInput) startInput.value = dateKey;
      if (endInput) endInput.value = '';

      if (infoEl) {
        infoEl.innerHTML = `<span style="color: var(--primary); font-weight: 700;">Start: ${this.formatDateShort(dateKey)}</span> — Now click End Date`;
      }
      this.renderMiniCalendar();
      // Keep open for second click
    } else {
      // Step 2: End date selected -> Accept range and close!
      let start = this.customStartDate;
      let end = dateKey;

      if (end < start) {
        const temp = start;
        start = end;
        end = temp;
      }

      this.customStartDate = start;
      this.customEndDate = end;
      this.customRangeSelectionStep = 0;

      if (startInput) startInput.value = start;
      if (endInput) endInput.value = end;

      // Apply range, update UI and close popover!
      this.applyCustomDateRange(start, end);
    }
  },

  /**
   * Apply custom date range filter to trades and close popover
   */
  applyCustomDateRange(start, end) {
    this.customStartDate = start;
    this.customEndDate = end;
    this.dateFilter = 'custom';
    this.customRangeSelectionStep = 0;

    const dateSelect = document.getElementById('headerDateRangeSelect');
    if (dateSelect) {
      dateSelect.value = 'custom';
      const customOpt = dateSelect.querySelector('option[value="custom"]');
      if (customOpt) {
        customOpt.innerText = `Custom (${this.formatDateShort(start)} - ${this.formatDateShort(end)})`;
      }
    }

    const customPopover = document.getElementById('customDatePopover');
    if (customPopover) {
      customPopover.style.display = 'none';
    }

    this.processTrades();
    this.showToast(`Filtered: ${this.formatDateShort(start)} → ${this.formatDateShort(end)}`, 'success');
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
    const parts = dateStr.slice(0, 10).split('-').map(Number);
    if (parts.length === 3) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[parts[1] - 1]} ${parts[2]}, ${parts[0]}`;
    }
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

    // Profitable Day (Best Day of Week)
    const profDayEl = document.getElementById('kpiProfitableDay');
    const profDaySubEl = document.getElementById('kpiProfitableDaySub');
    if (profDayEl) {
      if (m.profitableDay) {
        profDayEl.innerText = m.profitableDay.dayName;
        profDayEl.className = `kpi-value ${m.profitableDay.pnl >= 0 ? 'profit' : 'loss'}`;
        if (profDaySubEl) {
          const pnlFormatted = TradeAnalytics.formatCurrency(m.profitableDay.pnl);
          const icon = m.profitableDay.pnl >= 0 ? '▲' : '▼';
          const pnlClass = m.profitableDay.pnl >= 0 ? 'delta-pos' : 'delta-neg';
          profDaySubEl.innerHTML = `<span class="${pnlClass}">${icon} ${pnlFormatted}</span> • ${m.profitableDay.winRate}% win rate (${m.profitableDay.trades} trades)`;
        }
      } else {
        profDayEl.innerText = '--';
        profDayEl.className = 'kpi-value';
        if (profDaySubEl) profDaySubEl.innerHTML = `<span style="color: var(--text-dim);">No trades recorded</span>`;
      }
    }

    // Lossing Day (Worst Day of Week)
    const lossDayEl = document.getElementById('kpiLossingDay');
    const lossDaySubEl = document.getElementById('kpiLossingDaySub');
    if (lossDayEl) {
      if (m.lossingDay) {
        lossDayEl.innerText = m.lossingDay.dayName;
        lossDayEl.className = `kpi-value ${m.lossingDay.pnl <= 0 ? 'loss' : 'profit'}`;
        if (lossDaySubEl) {
          const pnlFormatted = TradeAnalytics.formatCurrency(m.lossingDay.pnl);
          const icon = m.lossingDay.pnl >= 0 ? '▲' : '▼';
          const pnlClass = m.lossingDay.pnl >= 0 ? 'delta-pos' : 'delta-neg';
          lossDaySubEl.innerHTML = `<span class="${pnlClass}">${icon} ${pnlFormatted}</span> • ${m.lossingDay.winRate}% win rate (${m.lossingDay.trades} trades)`;
        }
      } else {
        lossDayEl.innerText = '--';
        lossDayEl.className = 'kpi-value';
        if (lossDaySubEl) lossDaySubEl.innerHTML = `<span style="color: var(--text-dim);">No trades recorded</span>`;
      }
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
   * Render Trade Analytics View (Duration & Lot Size analysis)
   */
  renderAnalyticsView() {
    const metrics = this.currentMetrics;
    const duration = metrics?.durationMetrics;
    const lot = metrics?.lotMetrics;
    const hasTrades = this.filteredTrades && this.filteredTrades.length > 0;

    const emptyEl = document.getElementById('analyticsEmptyState');
    const contentEl = document.getElementById('analyticsMainContent');
    const tradesBadge = document.getElementById('analyticsTradesCountBadge');
    const rangeBadge = document.getElementById('analyticsFilteredRangeBadge');

    if (rangeBadge) {
      if (this.dateFilter === 'all') rangeBadge.innerText = 'All Time';
      else if (this.dateFilter === 'last30') rangeBadge.innerText = 'Last 30 Days';
      else if (this.dateFilter === 'custom') rangeBadge.innerText = `${this.customStartDate || '...'} to ${this.customEndDate || '...'}`;
      else rangeBadge.innerText = 'Active Filter';
    }

    if (tradesBadge) {
      tradesBadge.innerText = `${this.filteredTrades ? this.filteredTrades.length : 0} Trades`;
    }

    if (!hasTrades) {
      if (emptyEl) emptyEl.style.display = 'block';
      if (contentEl) contentEl.style.display = 'none';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'flex';

    // 1. DURATION METRICS
    const avgEl = document.getElementById('durationAvgVal');
    const medianEl = document.getElementById('durationMedianVal');
    const shortestEl = document.getElementById('durationShortestVal');
    const longestEl = document.getElementById('durationLongestVal');

    const winAvgEl = document.getElementById('durationWinAvgVal');
    const lossAvgEl = document.getElementById('durationLossAvgVal');
    const winCountEl = document.getElementById('durationWinCount');
    const lossCountEl = document.getElementById('durationLossCount');
    const ratioBanner = document.getElementById('durationRatioBanner');
    const ratioText = document.getElementById('durationRatioText');

    if (duration && duration.hasData) {
      if (avgEl) avgEl.innerText = TradeAnalytics.formatDuration(duration.avgDurationMs);
      if (medianEl) medianEl.innerText = TradeAnalytics.formatDuration(duration.medianDurationMs);
      if (shortestEl) shortestEl.innerText = TradeAnalytics.formatDuration(duration.shortestMs);
      if (longestEl) longestEl.innerText = TradeAnalytics.formatDuration(duration.longestMs);

      if (winAvgEl) winAvgEl.innerText = TradeAnalytics.formatDuration(duration.avgWinDurationMs);
      if (lossAvgEl) lossAvgEl.innerText = TradeAnalytics.formatDuration(duration.avgLossDurationMs);
      if (winCountEl) winCountEl.innerText = `${duration.winCount} trades`;
      if (lossCountEl) lossCountEl.innerText = `${duration.lossCount} trades`;

      if (ratioText) ratioText.innerText = duration.holdRatioText;
      if (ratioBanner) {
        ratioBanner.className = `hold-ratio-banner ${duration.holdComparisonClass}`;
      }
    } else {
      if (avgEl) avgEl.innerText = '--';
      if (medianEl) medianEl.innerText = '--';
      if (shortestEl) shortestEl.innerText = '--';
      if (longestEl) longestEl.innerText = '--';
      if (winAvgEl) winAvgEl.innerText = '--';
      if (lossAvgEl) lossAvgEl.innerText = '--';
      if (winCountEl) winCountEl.innerText = '0 trades';
      if (lossCountEl) lossCountEl.innerText = '0 trades';
      if (ratioText) ratioText.innerText = 'Not enough data to calculate trade duration.';
      if (ratioBanner) ratioBanner.className = 'hold-ratio-banner neutral';
    }

    // 2. LOT METRICS
    const lotAvgEl = document.getElementById('lotAvgVal');
    const lotMedianEl = document.getElementById('lotMedianVal');
    const lotSmallestEl = document.getElementById('lotSmallestVal');
    const lotLargestEl = document.getElementById('lotLargestVal');
    const lotVolEl = document.getElementById('lotTotalVolumeVal');

    if (lot && lot.hasData) {
      if (lotAvgEl) lotAvgEl.innerText = `${lot.avgLot} lots`;
      if (lotMedianEl) lotMedianEl.innerText = `${lot.medianLot} lots`;
      if (lotSmallestEl) lotSmallestEl.innerText = `${lot.smallestLot} lots`;
      if (lotLargestEl) lotLargestEl.innerText = `${lot.largestLot} lots`;
      if (lotVolEl) lotVolEl.innerText = `${lot.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lots`;
    } else {
      if (lotAvgEl) lotAvgEl.innerText = '--';
      if (lotMedianEl) lotMedianEl.innerText = '--';
      if (lotSmallestEl) lotSmallestEl.innerText = '--';
      if (lotLargestEl) lotLargestEl.innerText = '--';
      if (lotVolEl) lotVolEl.innerText = '--';
    }

    // Render Charts
    ChartManager.updateAnalyticsCharts(metrics);

    // Render Performance by Position Size Table
    this.renderLotPerformanceTable(lot);
  },

  /**
   * Render table of performance grouped by position size
   */
  renderLotPerformanceTable(lotMetrics) {
    const tbody = document.getElementById('lotPerformanceTableBody');
    if (!tbody) return;

    if (!lotMetrics || !lotMetrics.hasData || !lotMetrics.lotBreakdown || lotMetrics.lotBreakdown.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state-cell" style="text-align: center; color: var(--text-dim); padding: 24px;">No position size data available</td></tr>`;
      return;
    }

    tbody.innerHTML = lotMetrics.lotBreakdown.map(g => {
      const pnlSign = g.netPnL >= 0 ? '+' : '-';
      const pnlClass = g.netPnL >= 0 ? 'profit-text' : 'loss-text';
      const avgSign = g.avgPnL >= 0 ? '+' : '-';
      const avgClass = g.avgPnL >= 0 ? 'profit-text' : 'loss-text';
      const winRateColor = g.winRate >= 50 ? 'var(--profit)' : (g.winRate > 0 ? 'var(--loss)' : 'var(--text-dim)');

      return `
        <tr>
          <td style="font-weight: 700; font-family: var(--font-mono); color: var(--text-main);">${g.lotLabel} lots</td>
          <td><span class="analytics-tag" style="background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); padding: 2px 8px; border-radius: 4px; font-weight: 600;">${g.trades}</span></td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; font-family: var(--font-mono); color: ${winRateColor};">${g.winRate}%</span>
              <div style="width: 48px; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden;">
                <div style="width: ${Math.min(100, g.winRate)}%; height: 100%; background: ${winRateColor};"></div>
              </div>
            </div>
          </td>
          <td class="${pnlClass}" style="font-weight: 800; font-family: var(--font-mono);">${pnlSign}$${Math.abs(g.netPnL).toFixed(2)}</td>
          <td class="${avgClass}" style="font-weight: 700; font-family: var(--font-mono);">${avgSign}$${Math.abs(g.avgPnL).toFixed(2)}</td>
        </tr>
      `;
    }).join('');
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
      const v = el.getAttribute('data-view');
      const isMatch = v === viewName || 
        (viewName === 'journal' && v === 'analytics') || 
        (viewName === 'analytics' && v === 'journal');
      el.classList.toggle('active', isMatch);
    });

    // Update view sections
    document.querySelectorAll('.view-section').forEach(el => {
      const isMatch = el.id === `view-${viewName}` || 
        (viewName === 'journal' && el.id === 'view-analytics') || 
        (viewName === 'analytics' && el.id === 'view-journal');
      el.classList.toggle('active', isMatch);
    });

    // Update Header title
    const titleMap = {
      dashboard: 'Dashboard',
      analytics: 'Analytics',
      journal: 'Analytics',
      tradelog: 'Trade Log',
      backtesting: 'Backtesting',
      mt5: 'MetaTrader 5 (MT5)',
      reports: 'Reports & Performance',
      insights: 'AI & Rule Insights',
      strategies: 'Strategies',
      notebook: 'Trader Notebook'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.innerText = titleMap[viewName] || 'Dashboard';

    // If switching to MT5, re-render MT5 view
    if (viewName === 'mt5' && window.MT5Manager) {
      MT5Manager.render();
    }

    // If switching to reports, re-render charts to fit container
    if (viewName === 'reports') {
      this.renderReportsView();
    }

    // If switching to analytics, re-render charts to fit container
    if (viewName === 'analytics' || viewName === 'journal') {
      this.renderAnalyticsView();
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
    // Sidebar interaction: Desktop collapse & Mobile drawer
    const isMobileViewport = () => window.innerWidth <= 768;
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
    const brandToggleBtn = document.getElementById('sidebarBrandToggle');
    const revealBtn = document.getElementById('sidebarRevealBtn');
    const sidebarEl = document.getElementById('sidebar');

    const openMobileSidebar = () => {
      document.body.classList.add('sidebar-mobile-open');
    };
    const closeMobileSidebar = () => {
      document.body.classList.remove('sidebar-mobile-open');
    };

    if (revealBtn) {
      revealBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (isMobileViewport()) {
          openMobileSidebar();
        } else {
          document.body.classList.remove('sidebar-collapsed');
        }
      });
    }

    if (brandToggleBtn) {
      brandToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (isMobileViewport()) {
          closeMobileSidebar();
        } else {
          document.body.classList.add('sidebar-collapsed');
        }
      });
    }

    if (sidebarCloseBtn) {
      sidebarCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileSidebar();
      });
    }

    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileSidebar();
      });
    }

    // Tapping sidebar itself must NOT close it
    if (sidebarEl) {
      sidebarEl.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Navigation items: switch view and close drawer on mobile
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (item.id === 'sidebarInstallBtn') return;
        const view = item.getAttribute('data-view');
        if (view) this.switchView(view);
        if (isMobileViewport()) {
          closeMobileSidebar();
        }
      });
    });

    // Main Chart Cumulative / Daily / Weekly toggles
    const tabCum = document.getElementById('tabCumPnL');
    const tabDaily = document.getElementById('tabDailyPnL');
    const tabWeekly = document.getElementById('tabWeeklyPnL');

    const updateChartTabState = (activeBtn) => {
      [tabCum, tabDaily, tabWeekly].forEach(btn => {
        if (btn) btn.classList.remove('active');
      });
      if (activeBtn) activeBtn.classList.add('active');
    };

    if (tabCum) {
      tabCum.addEventListener('click', () => {
        updateChartTabState(tabCum);
        ChartManager.currentPnLView = 'cumulative';
        ChartManager.renderMainPnLChart(this.currentMetrics);
      });
    }

    if (tabDaily) {
      tabDaily.addEventListener('click', () => {
        updateChartTabState(tabDaily);
        ChartManager.currentPnLView = 'daily';
        ChartManager.renderMainPnLChart(this.currentMetrics);
      });
    }

    if (tabWeekly) {
      tabWeekly.addEventListener('click', () => {
        updateChartTabState(tabWeekly);
        ChartManager.currentPnLView = 'weekly';
        ChartManager.renderMainPnLChart(this.currentMetrics);
      });
    }

    // Analytics Lot Size Chart tabs (P&L vs Trades)
    const tabLotPnL = document.getElementById('tabLotPnL');
    const tabLotTrades = document.getElementById('tabLotTrades');
    if (tabLotPnL && tabLotTrades) {
      tabLotPnL.addEventListener('click', () => {
        tabLotPnL.classList.add('active');
        tabLotTrades.classList.remove('active');
        ChartManager.renderLotSizeChart(this.currentMetrics?.lotMetrics, 'pnl');
      });
      tabLotTrades.addEventListener('click', () => {
        tabLotTrades.classList.add('active');
        tabLotPnL.classList.remove('active');
        ChartManager.renderLotSizeChart(this.currentMetrics?.lotMetrics, 'trades');
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

    // Date Range Presets Dropdown & Custom Range Handler
    const dateSelect = document.getElementById('headerDateRangeSelect');
    const customPopover = document.getElementById('customDatePopover');
    const closePopoverBtn = document.getElementById('closeCustomDatePopover');
    const cancelCustomBtn = document.getElementById('btnCancelCustomDate');
    const applyCustomBtn = document.getElementById('btnApplyCustomDate');
    const startInput = document.getElementById('customStartDate');
    const endInput = document.getElementById('customEndDate');
    const miniPrev = document.getElementById('miniCalPrevBtn');
    const miniNext = document.getElementById('miniCalNextBtn');

    // Prevent any clicks inside popover from bubbling up to document outside-click handler
    if (customPopover) {
      customPopover.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    const openCustomPopover = () => {
      if (customPopover) {
        customPopover.style.display = 'flex';
        this.customRangeSelectionStep = 0;
        this.updateCustomDateBounds();
      }
    };

    const closeCustomPopover = () => {
      if (customPopover) {
        customPopover.style.display = 'none';
      }
      this.customRangeSelectionStep = 0;
    };

    const cancelCustomSelection = () => {
      closeCustomPopover();
      if (this.dateFilter !== 'custom' && dateSelect) {
        dateSelect.value = this.dateFilter;
      }
    };

    if (dateSelect) {
      dateSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'custom') {
          openCustomPopover();
        } else {
          closeCustomPopover();
          this.dateFilter = val;
          const customOpt = dateSelect.querySelector('option[value="custom"]');
          if (customOpt) customOpt.innerText = 'Custom';
          this.processTrades();
        }
      });

      dateSelect.addEventListener('click', () => {
        if (dateSelect.value === 'custom') {
          if (!customPopover || customPopover.style.display === 'none') {
            openCustomPopover();
          }
        }
      });
    }

    if (closePopoverBtn) {
      closePopoverBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelCustomSelection();
      });
    }

    if (cancelCustomBtn) {
      cancelCustomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelCustomSelection();
      });
    }

    if (startInput) {
      startInput.addEventListener('change', (e) => {
        this.customStartDate = e.target.value;
        const parts = this.customStartDate.split('-').map(Number);
        if (parts.length >= 2) {
          this.miniCalYear = parts[0];
          this.miniCalMonth = parts[1] - 1;
        }
        this.renderMiniCalendar();
      });
    }

    if (endInput) {
      endInput.addEventListener('change', (e) => {
        this.customEndDate = e.target.value;
        const parts = this.customEndDate.split('-').map(Number);
        if (parts.length >= 2) {
          this.miniCalYear = parts[0];
          this.miniCalMonth = parts[1] - 1;
        }
        this.renderMiniCalendar();
      });
    }

    if (miniPrev) {
      miniPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        this.miniCalMonth--;
        if (this.miniCalMonth < 0) {
          this.miniCalMonth = 11;
          this.miniCalYear--;
        }
        this.renderMiniCalendar();
      });
    }

    if (miniNext) {
      miniNext.addEventListener('click', (e) => {
        e.stopPropagation();
        this.miniCalMonth++;
        if (this.miniCalMonth > 11) {
          this.miniCalMonth = 0;
          this.miniCalYear++;
        }
        this.renderMiniCalendar();
      });
    }

    if (applyCustomBtn) {
      applyCustomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const s = document.getElementById('customStartDate')?.value;
        const eVal = document.getElementById('customEndDate')?.value;
        const { minDate, maxDate } = this.getAvailableDateRange();

        let start = s || minDate;
        let end = eVal || maxDate || start;

        if (start && end && start > end) {
          const temp = start;
          start = end;
          end = temp;
        }

        this.applyCustomDateRange(start, end);
      });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (customPopover && customPopover.style.display !== 'none') {
        const wrapper = document.querySelector('.date-filter-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
          cancelCustomSelection();
        }
      }
    });

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
  },

  /**
   * Initialize Progressive Web App (PWA) & Service Worker
   */
  initPWA() {
    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    // 2. Check if already installed / running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true ||
                         (document.referrer && document.referrer.includes('android-app://'));

    const installBtn = document.getElementById('sidebarInstallBtn');
    const installBadge = document.getElementById('installStatusBadge');
    const installBtnLabel = document.getElementById('installBtnLabel');
    const installModal = document.getElementById('installModal');
    const btnTriggerPrompt = document.getElementById('btnTriggerPrompt');
    const installNativeAction = document.getElementById('installNativeAction');
    const installInstructions = document.getElementById('installInstructions');

    if (isStandalone) {
      if (installBadge) {
        installBadge.textContent = 'Installed';
        installBadge.classList.add('installed');
      }
      if (installBtnLabel) {
        installBtnLabel.textContent = 'App Installed';
      }
    }

    // 3. Capture beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (installBadge && !isStandalone) {
        installBadge.textContent = 'Install';
        installBadge.style.display = 'inline-block';
      }
      if (installNativeAction) {
        installNativeAction.style.display = 'block';
      }
    });

    // 4. Listen for appinstalled
    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      if (installBadge) {
        installBadge.textContent = 'Installed';
        installBadge.classList.add('installed');
      }
      if (installBtnLabel) {
        installBtnLabel.textContent = 'App Installed';
      }
      if (installModal) {
        installModal.classList.remove('active');
      }
      this.showToast('TradeForge installed successfully! Welcome to the app! 🎉', 'success');
    });

    // 5. Render platform-tailored instructions in modal
    const populateInstallInstructions = () => {
      if (!installInstructions) return;
      const ua = navigator.userAgent || '';
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
      const isMacSafari = /^((?!chrome|android).)*safari/i.test(ua) && !isIOS;

      if (isIOS) {
        installInstructions.innerHTML = `
          <div class="install-guide-box">
            <div style="font-weight: 700; color: #818cf8; font-size: 0.82rem; margin-bottom: 4px;">iOS Safari Installation:</div>
            <div class="install-guide-step">
              <div class="install-guide-num">1</div>
              <div>Tap the <strong>Share</strong> button <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="15" x2="12" y2="3"/></svg> in Safari's bottom toolbar.</div>
            </div>
            <div class="install-guide-step">
              <div class="install-guide-num">2</div>
              <div>Scroll down and tap <strong>"Add to Home Screen"</strong>.</div>
            </div>
            <div class="install-guide-step">
              <div class="install-guide-num">3</div>
              <div>Tap <strong>"Add"</strong> in the top-right corner to finish.</div>
            </div>
          </div>
        `;
      } else if (isMacSafari) {
        installInstructions.innerHTML = `
          <div class="install-guide-box">
            <div style="font-weight: 700; color: #818cf8; font-size: 0.82rem; margin-bottom: 4px;">macOS Safari Installation:</div>
            <div class="install-guide-step">
              <div class="install-guide-num">1</div>
              <div>Click <strong>File</strong> in the macOS menu bar (or Share button).</div>
            </div>
            <div class="install-guide-step">
              <div class="install-guide-num">2</div>
              <div>Select <strong>"Add to Dock..."</strong>.</div>
            </div>
            <div class="install-guide-step">
              <div class="install-guide-num">3</div>
              <div>Click <strong>"Add"</strong> to launch TradeForge as a standalone application.</div>
            </div>
          </div>
        `;
      } else {
        installInstructions.innerHTML = `
          <div class="install-guide-box">
            <div style="font-weight: 700; color: #818cf8; font-size: 0.82rem; margin-bottom: 4px;">Chrome / Edge / Android Installation:</div>
            <div class="install-guide-step">
              <div class="install-guide-num">1</div>
              <div>Click the <strong>Install</strong> icon in the address bar (or browser menu <strong>⋮</strong>).</div>
            </div>
            <div class="install-guide-step">
              <div class="install-guide-num">2</div>
              <div>Select <strong>"Install TradeForge"</strong> or <strong>"Add to Home screen"</strong>.</div>
            </div>
            <div class="install-guide-step">
              <div class="install-guide-num">3</div>
              <div>Confirm by clicking <strong>"Install"</strong>.</div>
            </div>
          </div>
        `;
      }
    };

    // 6. Handle sidebar install button click
    if (installBtn) {
      installBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isStandalone) {
          this.showToast('TradeForge is already running as an installed standalone app! ✓', 'success');
          return;
        }

        if (this.deferredInstallPrompt) {
          this.deferredInstallPrompt.prompt();
          const choice = await this.deferredInstallPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') {
            this.showToast('Installing TradeForge... Welcome! 🎉', 'success');
            if (installBadge) {
              installBadge.textContent = 'Installed';
              installBadge.classList.add('installed');
            }
            if (installBtnLabel) installBtnLabel.textContent = 'App Installed';
            if (installModal) installModal.classList.remove('active');
          }
          this.deferredInstallPrompt = null;
        } else {
          // Open guidance modal
          populateInstallInstructions();
          if (installModal) {
            installModal.classList.add('active');
          }
        }
      });
    }

    if (btnTriggerPrompt) {
      btnTriggerPrompt.addEventListener('click', async (e) => {
        e.preventDefault();
        if (this.deferredInstallPrompt) {
          this.deferredInstallPrompt.prompt();
          const choice = await this.deferredInstallPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') {
            this.showToast('Installing TradeForge... Welcome! 🎉', 'success');
            if (installModal) installModal.classList.remove('active');
          }
          this.deferredInstallPrompt = null;
        }
      });
    }

    // Modal close buttons
    const closeInstallModal = () => {
      if (installModal) installModal.classList.remove('active');
    };
    const installCloseBtn = document.getElementById('installModalCloseBtn');
    const installCancelBtn = document.getElementById('installModalCancelBtn');
    if (installCloseBtn) installCloseBtn.addEventListener('click', closeInstallModal);
    if (installCancelBtn) installCancelBtn.addEventListener('click', closeInstallModal);
    if (installModal) {
      installModal.addEventListener('click', (e) => {
        if (e.target === installModal) closeInstallModal();
      });
    }
  }
};

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
