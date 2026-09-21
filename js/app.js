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

  // Weekly Performance Chart state
  weeklyPerfState: {
    mode: 'all', // 'all', 'month', 'week'
    selectedMonth: null, // 'YYYY-MM'
    selectedWeek: null, // 'YYYY-MM-DD_YYYY-MM-DD'
    weekStart: null,
    weekEnd: null
  },

  /**
   * Application Initialization
   */
  async init() {
    this.initCurrency();
    this.bindEvents();
    this.initPWA();
    if (typeof StrategyBotManager !== 'undefined') {
      StrategyBotManager.init();
    }
    if (typeof MT5Manager !== 'undefined') {
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
    this.renderWeeklyPerformance();
    CalendarManager.init(this.currentMetrics);
    this.renderRecentTradesTable();
    this.renderProfitSource();
    this.renderExitBreakdown();
    this.renderTradeLogTable();
    this.renderReportsView();
    this.renderAnalyticsView();
    this.renderInsightsView();
    this.renderStrategiesView();
    if (typeof StrategyBotManager !== 'undefined') {
      StrategyBotManager.updateContext();
    }
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
   * Update Top KPI Performance Cards (12 Cards)
   */
  updateKPICards() {
    const m = this.currentMetrics;

    // 1. Total P&L
    const totalPnlEl = document.getElementById('kpiTotalPnL');
    if (totalPnlEl) {
      totalPnlEl.innerText = TradeAnalytics.formatCurrency(m.totalPnL);
      totalPnlEl.className = `kpi-value ${m.totalPnL >= 0 ? 'profit' : 'loss'}`;
    }

    const tradesCountEl = document.getElementById('kpiTotalTradesCount');
    if (tradesCountEl) {
      tradesCountEl.innerText = `${m.totalTrades} trade${m.totalTrades === 1 ? '' : 's'}`;
    }

    // 2. Net Return
    const netReturnEl = document.getElementById('kpiNetReturn');
    const netReturnSubEl = document.getElementById('kpiNetReturnSub');
    const netReturnDisplay = document.getElementById('kpiNetReturnDisplay');
    const capitalInlineForm = document.getElementById('kpiCapitalInlineForm');
    const inlineInput = document.getElementById('kpiInlineCapitalInput');
    const inlinePrefix = document.getElementById('kpiInlineCurrencyPrefix');
    const editCapitalBtn = document.getElementById('btnEditCapital');

    const currSym = TradeAnalytics.getCurrencySymbol();
    if (inlinePrefix) {
      inlinePrefix.innerText = currSym;
    }

    if (m.startingCapital && m.startingCapital > 0 && m.netReturnPercent !== null) {
      if (netReturnDisplay) netReturnDisplay.style.display = 'block';
      if (capitalInlineForm) capitalInlineForm.style.display = 'none';
      if (editCapitalBtn) editCapitalBtn.innerText = 'Edit';

      if (netReturnEl) {
        const sign = m.netReturnPercent > 0 ? '+' : (m.netReturnPercent < 0 ? '-' : '');
        netReturnEl.innerText = `${sign}${Math.abs(m.netReturnPercent).toFixed(2)}%`;
        netReturnEl.className = `kpi-value ${m.netReturnPercent > 0 ? 'profit' : (m.netReturnPercent < 0 ? 'loss' : '')}`;
      }

      if (netReturnSubEl) {
        const pnlClass = m.totalPnL >= 0 ? 'delta-pos' : 'delta-neg';
        const pnlFmt = TradeAnalytics.formatCurrency(m.totalPnL);
        const capFmt = TradeAnalytics.formatCurrency(m.startingCapital, false);
        netReturnSubEl.innerHTML = `<span class="${pnlClass}">${pnlFmt}</span> on ${capFmt} balance <button type="button" class="btn-kpi-inline-edit" id="btnInlineEditCapital" title="Edit balance">✎</button>`;
        const inlineEditBtn = document.getElementById('btnInlineEditCapital');
        if (inlineEditBtn) {
          inlineEditBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showInlineCapitalInput();
          });
        }
      }
    } else {
      if (netReturnDisplay) netReturnDisplay.style.display = 'none';
      if (capitalInlineForm) capitalInlineForm.style.display = 'flex';
      if (editCapitalBtn) editCapitalBtn.innerText = 'Calculate';
      if (inlineInput) {
        try {
          if (typeof document !== 'undefined' && document.activeElement !== inlineInput) {
            inlineInput.value = '';
          }
        } catch (e) {
          inlineInput.value = '';
        }
      }
    }

    // 3. Profit Factor
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

    // 4. Win Rate
    const winRateEl = document.getElementById('kpiWinRate');
    if (winRateEl) {
      winRateEl.innerText = `${m.winRate.toFixed(1)}%`;
      winRateEl.className = `kpi-value ${m.winRate >= 50 ? 'profit' : (m.winRate > 0 ? 'loss' : '')}`;
    }
    const winRateSubEl = document.getElementById('kpiWinRateSub');
    if (winRateSubEl) {
      winRateSubEl.innerText = `${m.winnersCount}W / ${m.losersCount}L`;
    }

    // 5. Average Winning Trade
    const avgWinEl = document.getElementById('kpiAvgWin');
    if (avgWinEl) {
      avgWinEl.innerText = TradeAnalytics.formatCurrency(m.avgWin, false);
      avgWinEl.className = 'kpi-value profit';
    }
    const avgWinSubEl = document.getElementById('kpiAvgWinSub');
    if (avgWinSubEl) {
      avgWinSubEl.innerHTML = `<span class="delta-pos">▲ ${m.winnersCount} winning trades</span>`;
    }

    // 6. Average Losing Trade
    const avgLossEl = document.getElementById('kpiAvgLoss');
    if (avgLossEl) {
      avgLossEl.innerText = TradeAnalytics.formatCurrency(m.avgLoss, false);
      avgLossEl.className = 'kpi-value loss';
    }
    const avgLossSubEl = document.getElementById('kpiAvgLossSub');
    if (avgLossSubEl) {
      avgLossSubEl.innerHTML = `<span class="delta-neg">▼ ${m.losersCount} losing trades</span>`;
    }

    // 7. Expectancy / Trade
    const expEl = document.getElementById('kpiExpectancy');
    const expSubEl = document.getElementById('kpiExpectancySub');
    if (expEl) {
      expEl.innerText = `${TradeAnalytics.formatCurrency(m.expectancy)} / trade`;
      expEl.className = `kpi-value ${m.expectancy > 0 ? 'profit' : (m.expectancy < 0 ? 'loss' : '')}`;
    }
    if (expSubEl) {
      if (m.expectancy > 0) {
        expSubEl.innerHTML = `<span class="delta-pos">▲ Positive expectancy</span>`;
      } else if (m.expectancy < 0) {
        expSubEl.innerHTML = `<span class="delta-neg">▼ Negative expectancy</span>`;
      } else {
        expSubEl.innerHTML = `Avg return per trade`;
      }
    }

    // 8. Max Drawdown
    const maxDdEl = document.getElementById('kpiMaxDrawdown');
    const maxDdSubEl = document.getElementById('kpiMaxDrawdownSub');
    if (maxDdEl) {
      if (m.maxDrawdownAmount > 0) {
        maxDdEl.innerText = `-${TradeAnalytics.formatCurrency(m.maxDrawdownAmount, false)}`;
        maxDdEl.className = 'kpi-value loss';
      } else {
        maxDdEl.innerText = TradeAnalytics.formatCurrency(0, false);
        maxDdEl.className = 'kpi-value';
      }
    }
    if (maxDdSubEl) {
      if (m.startingCapital && m.startingCapital > 0 && m.maxDrawdownPercent !== null) {
        maxDdSubEl.innerHTML = `<span class="delta-neg">▼ -${m.maxDrawdownPercent.toFixed(2)}%</span> from peak equity`;
      } else {
        maxDdSubEl.innerHTML = `Realized equity decline`;
      }
    }

    // 9. Best Day (Most Profitable Day of Week)
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
          profDaySubEl.innerHTML = `<span class="${pnlClass}">${icon} ${pnlFormatted}</span> • ${m.profitableDay.winRate}% win rate • ${m.profitableDay.trades} trades`;
        }
      } else {
        profDayEl.innerText = '--';
        profDayEl.className = 'kpi-value';
        if (profDaySubEl) profDaySubEl.innerHTML = `<span style="color: var(--text-dim);">No trades recorded</span>`;
      }
    }

    // 10. Worst Day (Most Unprofitable Day of Week)
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
          lossDaySubEl.innerHTML = `<span class="${pnlClass}">${icon} ${pnlFormatted}</span> • ${m.lossingDay.winRate}% win rate • ${m.lossingDay.trades} trades`;
        }
      } else {
        lossDayEl.innerText = '--';
        lossDayEl.className = 'kpi-value';
        if (lossDaySubEl) lossDaySubEl.innerHTML = `<span style="color: var(--text-dim);">No trades recorded</span>`;
      }
    }

    // 11. Largest Profit Trade
    const largestProfitEl = document.getElementById('kpiLargestProfit');
    const largestProfitSubEl = document.getElementById('kpiLargestProfitSub');
    if (largestProfitEl) {
      if (m.maxWin > 0) {
        largestProfitEl.innerText = TradeAnalytics.formatCurrency(m.maxWin, false);
        largestProfitEl.className = 'kpi-value profit';
        if (largestProfitSubEl) {
          if (m.maxWinTrade) {
            const sym = m.maxWinTrade.symbol || 'Trade';
            const rawDate = m.maxWinTrade.closeTime ? m.maxWinTrade.closeTime.slice(0, 10) : (m.maxWinTrade.openTime ? m.maxWinTrade.openTime.slice(0, 10) : '');
            const date = rawDate ? this.formatDateShort(rawDate) : 'Winner';
            const lotsText = m.maxWinTrade.lots ? ` • ${m.maxWinTrade.lots} lot` : '';
            largestProfitSubEl.innerHTML = `<span class="delta-pos">▲ ${sym}</span> • ${date}${lotsText}`;
          } else {
            largestProfitSubEl.innerHTML = `<span class="delta-pos">▲ Best trade</span>`;
          }
        }
      } else {
        largestProfitEl.innerText = TradeAnalytics.formatCurrency(0, false);
        largestProfitEl.className = 'kpi-value';
        if (largestProfitSubEl) {
          largestProfitSubEl.innerHTML = `<span style="color: var(--text-dim);">No winning trades</span>`;
        }
      }
    }

    // 12. Largest Loss Trade
    const largestLossEl = document.getElementById('kpiLargestLoss');
    const largestLossSubEl = document.getElementById('kpiLargestLossSub');
    if (largestLossEl) {
      if (m.maxLoss < 0) {
        largestLossEl.innerText = TradeAnalytics.formatCurrency(m.maxLoss, false);
        largestLossEl.className = 'kpi-value loss';
        if (largestLossSubEl) {
          if (m.maxLossTrade) {
            const sym = m.maxLossTrade.symbol || 'Trade';
            const rawDate = m.maxLossTrade.closeTime ? m.maxLossTrade.closeTime.slice(0, 10) : (m.maxLossTrade.openTime ? m.maxLossTrade.openTime.slice(0, 10) : '');
            const date = rawDate ? this.formatDateShort(rawDate) : 'Worst';
            const lotsText = m.maxLossTrade.lots ? ` • ${m.maxLossTrade.lots} lot` : '';
            largestLossSubEl.innerHTML = `<span class="delta-neg">▼ ${sym}</span> • ${date}${lotsText}`;
          } else {
            largestLossSubEl.innerHTML = `<span class="delta-neg">▼ Worst trade</span>`;
          }
        }
      } else {
        largestLossEl.innerText = TradeAnalytics.formatCurrency(0, false);
        largestLossEl.className = 'kpi-value';
        if (largestLossSubEl) {
          largestLossSubEl.innerHTML = `<span style="color: var(--text-dim);">No losing trades</span>`;
        }
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
      const pnlColor = trade.profit > 0 ? 'var(--profit)' : (trade.profit < 0 ? 'var(--loss)' : 'var(--neutral)');

      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 0.78rem;">${dateFormatted}</td>
        <td><span class="symbol-badge">${trade.symbol}</span></td>
        <td>${trade.lots}</td>
        <td><span class="type-badge ${trade.type}">${trade.type.toUpperCase()}</span></td>
        <td class="${pnlClass}" style="color: ${pnlColor}; font-weight: 700; font-family: var(--font-mono);">${pnlFormatted}</td>
      `;

      tr.addEventListener('click', () => this.openTradeDetailModal(trade));
      tbody.appendChild(tr);
    });
  },

  /**
   * Render Profit Source Card on Dashboard
   */
  renderProfitSource() {
    const body = document.getElementById('profitSourceBody');
    const badge = document.getElementById('profitSourceBadge');
    const sub = document.getElementById('profitSourceSub');
    if (!body) return;

    body.innerHTML = '';
    const ps = this.currentMetrics ? this.currentMetrics.symbolProfitSource : null;

    if (!ps || (!ps.all || ps.all.length === 0)) {
      if (badge) badge.innerText = '0 symbols';
      if (sub) sub.innerText = 'Realized P&L by symbol';
      body.innerHTML = `<div class="breakdown-empty-state">No trades in selected date range</div>`;
      return;
    }

    const totalSymbolsCount = ps.all.length;
    if (badge) {
      badge.innerText = `${totalSymbolsCount} symbol${totalSymbolsCount === 1 ? '' : 's'}`;
    }

    if (sub) {
      if (ps.isTotalPositive) {
        sub.innerText = 'Realized P&L & contribution by symbol';
      } else {
        sub.innerText = 'Realized P&L by symbol (total P&L ≤ 0)';
      }
    }

    // Determine max absolute P&L to scale horizontal bars proportionally
    const maxAbsPnL = Math.max(...ps.all.map(s => Math.abs(s.pnl)), 1);

    const topPositive = ps.positive.slice(0, 5);
    const topNegative = ps.negative.slice(0, 3);
    const hasZero = ps.zero.length > 0 && topPositive.length === 0 && topNegative.length === 0;

    const renderSymbolRow = (s) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'breakdown-item';

      const pnlFormatted = TradeAnalytics.formatCurrency(s.pnl, true);
      const pnlColor = s.pnl > 0 ? 'var(--profit)' : (s.pnl < 0 ? 'var(--loss)' : 'var(--text-muted)');
      
      let pctText = '--';
      if (s.contributionPercent !== null && s.contributionPercent !== undefined) {
        pctText = `${s.contributionPercent}%`;
      }

      const barWidth = Math.max(4, Math.min(100, Math.round((Math.abs(s.pnl) / maxAbsPnL) * 100)));
      const fillClass = s.pnl >= 0 ? 'profit' : 'loss';

      itemEl.innerHTML = `
        <div class="breakdown-item-header">
          <div class="breakdown-item-name">
            <span class="symbol-badge">${s.symbol}</span>
            <span style="font-size: 0.72rem; color: var(--text-dim);">${s.trades} trade${s.trades === 1 ? '' : 's'} (${s.winRate}% win)</span>
          </div>
          <div class="breakdown-item-values">
            <span class="breakdown-item-pnl" style="color: ${pnlColor};">${pnlFormatted}</span>
            <span class="breakdown-item-pct" title="Contribution to positive total P&L">${pctText}</span>
          </div>
        </div>
        <div class="breakdown-bar-track">
          <div class="breakdown-bar-fill ${fillClass}" style="width: ${barWidth}%;"></div>
        </div>
      `;
      return itemEl;
    };

    // Render positive section if any
    if (topPositive.length > 0) {
      if (topNegative.length > 0) {
        const header = document.createElement('div');
        header.className = 'breakdown-section-title';
        header.innerText = 'Top Profitable Symbols';
        body.appendChild(header);
      }
      topPositive.forEach(s => {
        body.appendChild(renderSymbolRow(s));
      });
      if (ps.positive.length > 5) {
        const more = document.createElement('div');
        more.className = 'breakdown-more-text';
        more.innerText = `+ ${ps.positive.length - 5} more profitable symbol(s)`;
        body.appendChild(more);
      }
    }

    // Render negative section if any
    if (topNegative.length > 0) {
      if (topPositive.length > 0) {
        const div = document.createElement('div');
        div.className = 'breakdown-section-divider';
        body.appendChild(div);
        const header = document.createElement('div');
        header.className = 'breakdown-section-title';
        header.innerText = 'Top Loss Symbols';
        body.appendChild(header);
      }
      topNegative.forEach(s => {
        body.appendChild(renderSymbolRow(s));
      });
      if (ps.negative.length > 3) {
        const more = document.createElement('div');
        more.className = 'breakdown-more-text';
        more.innerText = `+ ${ps.negative.length - 3} more losing symbol(s)`;
        body.appendChild(more);
      }
    }

    // If only zero PnL symbols exist
    if (hasZero) {
      ps.zero.slice(0, 5).forEach(s => {
        body.appendChild(renderSymbolRow(s));
      });
    }

    // If total P&L <= 0, add subtle note about contribution %
    if (!ps.isTotalPositive && ps.all.length > 0) {
      const note = document.createElement('div');
      note.className = 'breakdown-note';
      note.innerText = '* Contribution % unavailable when total realized P&L is ≤ 0';
      body.appendChild(note);
    }
  },

  /**
   * Render Exit Breakdown Card on Dashboard
   */
  renderExitBreakdown() {
    const body = document.getElementById('exitBreakdownBody');
    const badge = document.getElementById('exitBreakdownBadge');
    const sub = document.getElementById('exitBreakdownSub');
    if (!body) return;

    body.innerHTML = '';
    const eb = this.currentMetrics ? this.currentMetrics.exitBreakdown : null;
    const totalTrades = this.currentMetrics ? this.currentMetrics.totalTrades : 0;

    if (!eb || eb.length === 0 || totalTrades === 0) {
      if (badge) badge.innerText = '0 exits';
      if (sub) sub.innerText = 'Distribution by close reason';
      body.innerHTML = `<div class="breakdown-empty-state">No exit data in selected date range</div>`;
      return;
    }

    if (badge) {
      badge.innerText = `${totalTrades} exit${totalTrades === 1 ? '' : 's'}`;
    }

    const reasonMeta = {
      'TP': { label: 'Take Profit', badgeClass: 'tp', fillClass: 'tp', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' },
      'SL': { label: 'Stop Loss', badgeClass: 'sl', fillClass: 'sl', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
      'USER': { label: 'Manual / Client', badgeClass: 'user', fillClass: 'user', bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' },
      'STOP OUT': { label: 'Margin Stop Out', badgeClass: 'so', fillClass: 'so', bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' },
      'UNKNOWN': { label: 'Unspecified', badgeClass: 'unknown', fillClass: 'unknown', bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }
    };

    eb.forEach(item => {
      const meta = reasonMeta[item.reason] || {
        label: item.reason,
        badgeClass: 'unknown',
        fillClass: 'unknown',
        bg: 'rgba(100, 116, 139, 0.15)',
        color: '#94a3b8'
      };

      const itemEl = document.createElement('div');
      itemEl.className = 'breakdown-item';

      const pnlFormatted = TradeAnalytics.formatCurrency(item.pnl, true);
      const pnlColor = item.pnl > 0 ? 'var(--profit)' : (item.pnl < 0 ? 'var(--loss)' : 'var(--text-muted)');
      const barWidth = Math.max(item.percentage > 0 ? 3 : 0, Math.min(100, item.percentage));

      itemEl.innerHTML = `
        <div class="breakdown-item-header">
          <div class="breakdown-item-name">
            <span class="breakdown-item-badge" style="background: ${meta.bg}; color: ${meta.color}; border: 1px solid ${meta.color}40;">${item.reason}</span>
            <span style="font-size: 0.72rem; color: var(--text-dim);">${meta.label}</span>
          </div>
          <div class="breakdown-item-values">
            <span class="breakdown-item-pnl" style="color: ${pnlColor};">${pnlFormatted}</span>
            <span class="breakdown-item-pct">${item.count} (${item.percentage}%)</span>
          </div>
        </div>
        <div class="breakdown-bar-track">
          <div class="breakdown-bar-fill ${meta.fillClass}" style="width: ${barWidth}%;"></div>
        </div>
      `;
      body.appendChild(itemEl);
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
      const pnlColor = trade.profit > 0 ? 'var(--profit)' : (trade.profit < 0 ? 'var(--loss)' : 'var(--neutral)');

      tr.innerHTML = `
        <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-dim);">${trade.ticket}</td>
        <td><span class="symbol-badge">${trade.symbol}</span></td>
        <td><span class="type-badge ${trade.type}">${trade.type.toUpperCase()}</span></td>
        <td>${trade.lots}</td>
        <td>${trade.openPrice || '-'}</td>
        <td>${trade.closePrice || '-'}</td>
        <td style="font-size: 0.78rem; color: var(--text-muted);">${openTimeFmt}</td>
        <td style="font-size: 0.78rem; color: var(--text-muted);">${closeTimeFmt}</td>
        <td class="${pnlClass}" style="color: ${pnlColor}; font-weight: 700; font-family: var(--font-mono);">${pnlFormatted}</td>
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
      const pnlSign = g.netPnL > 0 ? '+' : (g.netPnL < 0 ? '-' : '');
      const pnlClass = g.netPnL > 0 ? 'profit-text' : (g.netPnL < 0 ? 'loss-text' : 'neutral-text');
      const pnlColor = g.netPnL > 0 ? 'var(--profit)' : (g.netPnL < 0 ? 'var(--loss)' : 'var(--neutral)');
      const avgSign = g.avgPnL > 0 ? '+' : (g.avgPnL < 0 ? '-' : '');
      const avgClass = g.avgPnL > 0 ? 'profit-text' : (g.avgPnL < 0 ? 'loss-text' : 'neutral-text');
      const avgColor = g.avgPnL > 0 ? 'var(--profit)' : (g.avgPnL < 0 ? 'var(--loss)' : 'var(--neutral)');
      const winRateColor = g.winRate >= 50 ? 'var(--profit)' : (g.winRate > 0 ? 'var(--loss)' : 'var(--text-dim)');

      const sym = TradeAnalytics.getCurrencySymbol();
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
          <td class="${pnlClass}" style="font-weight: 800; font-family: var(--font-mono); color: ${pnlColor};">${pnlSign}$${Math.abs(g.netPnL).toFixed(2)}</td>
          <td class="${avgClass}" style="font-weight: 700; font-family: var(--font-mono); color: ${avgColor};">${avgSign}$${Math.abs(g.avgPnL).toFixed(2)}</td>
          <td class="${pnlClass}" style="font-weight: 800; font-family: var(--font-mono); color: ${pnlColor};">${pnlSign}${sym}${Math.abs(g.netPnL).toFixed(2)}</td>
          <td class="${avgClass}" style="font-weight: 700; font-family: var(--font-mono); color: ${avgColor};">${avgSign}${sym}${Math.abs(g.avgPnL).toFixed(2)}</td>
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

    const sym = TradeAnalytics.getCurrencySymbol();
    const strategies = [
      { name: 'XAUUSD Breakout Strategy', symbol: 'XAUUSD', trades: 70, winrate: '54.2%', pnl: `+${sym}342.10`, status: 'Profitable' },
      { name: 'BTCUSD Trend Momentum', symbol: 'BTCUSD', trades: 18, winrate: '61.1%', pnl: `+${sym}94.80`, status: 'Profitable' },
      { name: 'Major FX Mean Reversion', symbol: 'EURUSD', trades: 11, winrate: '45.4%', pnl: `-${sym}180.54`, status: 'Reviewing' }
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
    this._activeDayKey = dateKey;
    this._activeDayData = dayData;
    const modal = document.getElementById('dayTradesModal');
    const title = document.getElementById('dayTradesModalTitle');
    const body = document.getElementById('dayTradesModalBody');
    if (!modal || !body) return;

    title.innerText = `Trades on ${dateKey} (${TradeAnalytics.formatCurrency(dayData.pnl)})`;

    const sym = TradeAnalytics.getCurrencySymbol();
    let html = `
      <table class="trade-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Symbol</th>
            <th>Type</th>
            <th>Lots</th>
            <th>P/L (${sym})</th>
          </tr>
        </thead>
        <tbody>
    `;

    dayData.tradeList.forEach(t => {
      const timeOnly = (t.closeTime || t.openTime || '').slice(11, 16);
      const pnlFormatted = TradeAnalytics.formatCurrency(t.profit);
      const pnlClass = t.profit > 0 ? 'profit-text' : (t.profit < 0 ? 'loss-text' : 'neutral-text');
      const pnlColor = t.profit > 0 ? 'var(--profit)' : (t.profit < 0 ? 'var(--loss)' : 'var(--neutral)');

      html += `
        <tr onclick="App.openTradeDetailModal(${JSON.stringify(t).replace(/"/g, '&quot;')})">
          <td style="color: var(--text-dim);">${timeOnly}</td>
          <td><span class="symbol-badge">${t.symbol}</span></td>
          <td><span class="type-badge ${t.type}">${t.type.toUpperCase()}</span></td>
          <td>${t.lots}</td>
          <td class="${pnlClass}" style="color: ${pnlColor}; font-weight: 700; font-family: var(--font-mono);">${pnlFormatted}</td>
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
   * Currency Switcher Management ($ / ₹)
   */
  initCurrency() {
    const savedCurrency = (typeof localStorage !== 'undefined' && localStorage.getItem('tradeforge_currency')) || 'USD';
    TradeAnalytics.setCurrency(savedCurrency);
    this.updateCurrencyUI(savedCurrency);
  },

  setCurrency(curr) {
    const sym = TradeAnalytics.setCurrency(curr);
    this.updateCurrencyUI(curr);

    // Re-render all components with the new currency
    this.updateKPICards();
    this.renderRecentTradesTable();
    this.renderProfitSource();
    this.renderExitBreakdown();
    this.renderTradeLogTable();
    this.renderReportsView();
    this.renderAnalyticsView();
    this.renderInsightsView();
    this.renderStrategiesView();

    if (typeof ChartManager !== 'undefined' && this.currentMetrics) {
      ChartManager.updateDashboardCharts(this.currentMetrics);
      ChartManager.updateAnalyticsCharts(this.currentMetrics);
      this.renderWeeklyPerformance();
    }
    if (typeof CalendarManager !== 'undefined') {
      CalendarManager.update(this.currentMetrics);
    }
    if (typeof MT5Manager !== 'undefined' && MT5Manager.updateAccountCards) {
      MT5Manager.updateAccountCards();
      MT5Manager.renderOverview();
      MT5Manager.renderPositions();
      MT5Manager.renderHistory();
    }
    if (typeof StrategyBotManager !== 'undefined') {
      StrategyBotManager.updateContext();
    }

    // If day trades modal is open, re-render it with new currency
    const dayTradesModal = document.getElementById('dayTradesModal');
    if (dayTradesModal && dayTradesModal.classList.contains('active') && this._activeDayKey && this._activeDayData) {
      this.openDayTradesModal(this._activeDayKey, this._activeDayData);
    }

    this.showToast(`Currency updated to ${curr === 'INR' ? 'INR (₹)' : 'USD ($)'}`, 'info');
  },

  updateCurrencyUI(curr) {
    const toggle = document.getElementById('currencySliderToggle');
    const btnUSD = document.getElementById('btnCurrUSD');
    const btnINR = document.getElementById('btnCurrINR');
    const sym = curr === 'INR' ? '₹' : '$';

    if (toggle) {
      toggle.setAttribute('data-currency', curr);
    }
    if (btnUSD) {
      btnUSD.classList.toggle('active', curr === 'USD');
    }
    if (btnINR) {
      btnINR.classList.toggle('active', curr === 'INR');
    }

    // Update all static currency symbol labels across all views/tables
    document.querySelectorAll('.currency-sym').forEach(el => {
      el.textContent = sym;
    });

    // Update inline currency prefix in Net Return card if present
    const inlinePrefix = document.getElementById('kpiInlineCurrencyPrefix');
    if (inlinePrefix) {
      inlinePrefix.innerText = sym;
    }
  },

  /**
   * Show inline capital input inside Net Return card
   */
  showInlineCapitalInput() {
    const netReturnDisplay = document.getElementById('kpiNetReturnDisplay');
    const capitalInlineForm = document.getElementById('kpiCapitalInlineForm');
    const inlineInput = document.getElementById('kpiInlineCapitalInput');
    const editCapitalBtn = document.getElementById('btnEditCapital');

    if (netReturnDisplay) netReturnDisplay.style.display = 'none';
    if (capitalInlineForm) capitalInlineForm.style.display = 'flex';
    if (editCapitalBtn) editCapitalBtn.innerText = 'Calculate';

    if (inlineInput) {
      const curCap = TradeAnalytics.getStartingCapital();
      if (curCap) inlineInput.value = curCap;
      setTimeout(() => {
        inlineInput.focus();
        inlineInput.select();
      }, 30);
    }
  },

  /**
   * Apply starting capital directly from the Net Return card input
   */
  applyInlineStartingCapital() {
    const input = document.getElementById('kpiInlineCapitalInput');
    const rawVal = input ? input.value.trim() : '';
    const num = (rawVal === '' || isNaN(Number(rawVal)) || Number(rawVal) <= 0) ? null : Number(rawVal);
    const saved = TradeAnalytics.setStartingCapital(num);

    this.processTrades();

    if (saved !== null) {
      this.showToast(`Starting balance set to ${TradeAnalytics.formatCurrency(saved, false)} — calculations updated`, 'success');
    } else {
      this.showToast('Starting balance cleared', 'info');
    }
  },

  /**
   * Starting Capital Modal Management
   */
  openStartingCapitalModal() {
    const modal = document.getElementById('startingCapitalModal');
    const input = document.getElementById('startingCapitalInput');
    const headerSym = document.getElementById('capitalModalHeaderSym');
    const prefixSym = document.getElementById('capitalInputCurrencyPrefix');
    const currentDisp = document.getElementById('capitalCurrentDisplay');
    const sym = TradeAnalytics.getCurrencySymbol();

    if (headerSym) headerSym.innerText = sym;
    if (prefixSym) prefixSym.innerText = sym;

    const currentCapital = TradeAnalytics.getStartingCapital();
    if (currentDisp) {
      currentDisp.innerText = currentCapital ? `Current: ${TradeAnalytics.formatCurrency(currentCapital, false)}` : 'Not set';
    }
    if (input) {
      input.value = currentCapital !== null ? currentCapital : '';
    }
    if (modal) {
      modal.classList.add('active');
      setTimeout(() => {
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);
    }
  },

  closeStartingCapitalModal() {
    const modal = document.getElementById('startingCapitalModal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  saveStartingCapital() {
    const input = document.getElementById('startingCapitalInput');
    const rawVal = input ? input.value.trim() : '';
    const num = (rawVal === '' || isNaN(Number(rawVal)) || Number(rawVal) <= 0) ? null : Number(rawVal);
    const saved = TradeAnalytics.setStartingCapital(num);

    this.closeStartingCapitalModal();
    this.processTrades();

    if (saved !== null) {
      this.showToast(`Starting capital updated to ${TradeAnalytics.formatCurrency(saved, false)}`, 'success');
    } else {
      this.showToast('Starting capital cleared', 'info');
    }
  },

  resetStartingCapital() {
    TradeAnalytics.setStartingCapital(null);
    const input = document.getElementById('startingCapitalInput');
    if (input) input.value = '';

    this.closeStartingCapitalModal();
    this.processTrades();
    this.showToast('Starting capital reset', 'info');
  },

  /**
   * Switch Navigation View
   */
  switchView(viewName) {
    this.activeView = viewName;

    try {
      if (window.location.hash !== `#${viewName}`) {
        history.replaceState(null, '', `#${viewName}`);
      }
    } catch (e) {}

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
      'strategy-bot': 'Strategy Bot',
      mt5: 'MetaTrader 5 (MT5)',
      reports: 'Reports & Performance',
      insights: 'AI & Rule Insights',
      strategies: 'Strategies',
      notebook: 'Trader Notebook'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.innerText = titleMap[viewName] || 'Dashboard';

    // If switching to Strategy Bot, notify manager
    if (viewName === 'strategy-bot' && typeof StrategyBotManager !== 'undefined') {
      StrategyBotManager.onViewActivated();
    }

    // If switching to MT5, re-render MT5 view
    if (viewName === 'mt5' && typeof MT5Manager !== 'undefined') {
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

    // Handle URL hash changes & deep linking
    window.addEventListener('hashchange', () => {
      const hash = (window.location.hash || '').replace('#', '');
      if (hash && document.querySelector(`.nav-item[data-view="${hash}"]`)) {
        this.switchView(hash);
      }
    });
    if (window.location.hash) {
      const initialHash = window.location.hash.replace('#', '');
      if (initialHash && document.querySelector(`.nav-item[data-view="${initialHash}"]`)) {
        setTimeout(() => this.switchView(initialHash), 100);
      }
    }

    // Main Chart Cumulative / Daily / Weekly / Monthly toggles
    const tabCum = document.getElementById('tabCumPnL');
    const tabDaily = document.getElementById('tabDailyPnL');
    const tabWeekly = document.getElementById('tabWeeklyPnL');
    const tabMonthly = document.getElementById('tabMonthlyPnL');

    const updateChartTabState = (activeBtn) => {
      [tabCum, tabDaily, tabWeekly, tabMonthly].forEach(btn => {
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

    if (tabMonthly) {
      tabMonthly.addEventListener('click', () => {
        updateChartTabState(tabMonthly);
        ChartManager.currentPnLView = 'monthly';
        ChartManager.renderMainPnLChart(this.currentMetrics);
      });
    }

    // Weekly Performance card controls initialization
    this.initWeeklyPerformance();

    // Starting Capital triggers & actions (Inline card input + Modal)
    const btnEditCap = document.getElementById('btnEditCapital');
    if (btnEditCap) {
      btnEditCap.addEventListener('click', (e) => {
        e.stopPropagation();
        const capitalInlineForm = document.getElementById('kpiCapitalInlineForm');
        if (capitalInlineForm && capitalInlineForm.style.display !== 'none') {
          this.applyInlineStartingCapital();
        } else {
          this.showInlineCapitalInput();
        }
      });
    }

    const btnInlineCalc = document.getElementById('btnInlineCalculateCapital');
    if (btnInlineCalc) {
      btnInlineCalc.addEventListener('click', (e) => {
        e.stopPropagation();
        this.applyInlineStartingCapital();
      });
    }

    const inlineCapInput = document.getElementById('kpiInlineCapitalInput');
    if (inlineCapInput) {
      inlineCapInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.applyInlineStartingCapital();
        }
      });
    }

    const netReturnCard = document.getElementById('kpiNetReturnCard');
    if (netReturnCard) {
      netReturnCard.addEventListener('click', (e) => {
        if (e.target.closest('.set-capital-prompt')) {
          e.stopPropagation();
          this.showInlineCapitalInput();
        }
      });
    }

    const saveCapBtn = document.getElementById('btnSaveCapital');
    if (saveCapBtn) {
      saveCapBtn.addEventListener('click', () => this.saveStartingCapital());
    }

    const resetCapBtn = document.getElementById('btnResetCapital');
    if (resetCapBtn) {
      resetCapBtn.addEventListener('click', () => this.resetStartingCapital());
    }

    const cancelCapBtn = document.getElementById('btnCancelCapital');
    if (cancelCapBtn) {
      cancelCapBtn.addEventListener('click', () => this.closeStartingCapitalModal());
    }

    const closeCapModalBtn = document.getElementById('closeCapitalModalBtn');
    if (closeCapModalBtn) {
      closeCapModalBtn.addEventListener('click', () => this.closeStartingCapitalModal());
    }

    const capInput = document.getElementById('startingCapitalInput');
    if (capInput) {
      capInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.saveStartingCapital();
        } else if (e.key === 'Escape') {
          this.closeStartingCapitalModal();
        }
      });
    }

    const capModal = document.getElementById('startingCapitalModal');
    if (capModal) {
      capModal.addEventListener('click', (e) => {
        if (e.target === capModal) {
          this.closeStartingCapitalModal();
        }
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
    // Dynamic Currency Switcher Slider ($ / ₹)
    const btnUSD = document.getElementById('btnCurrUSD');
    const btnINR = document.getElementById('btnCurrINR');
    if (btnUSD) {
      btnUSD.addEventListener('click', () => this.setCurrency('USD'));
    }
    if (btnINR) {
      btnINR.addEventListener('click', () => this.setCurrency('INR'));
    }

    // Export JSON Button (Fallback if present)
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

    // File Input & Dropzone handling (Opens preview popup)
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
          this.previewCSVFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.previewCSVFile(e.target.files[0]);
          fileInput.value = ''; // Reset so same file can be re-selected if needed
        }
      });
    }

    // CSV Upload Preview Modal Actions
    const btnConfirmCsv = document.getElementById('btnConfirmCsvImport');
    if (btnConfirmCsv) {
      btnConfirmCsv.addEventListener('click', () => this.confirmCSVImport());
    }

    const btnCancelCsv = document.getElementById('btnCancelCsvPreview');
    if (btnCancelCsv) {
      btnCancelCsv.addEventListener('click', () => this.closeCSVPreviewModal());
    }

    const closeCsvPreviewBtn = document.getElementById('closeCsvPreviewModalBtn');
    if (closeCsvPreviewBtn) {
      closeCsvPreviewBtn.addEventListener('click', () => this.closeCSVPreviewModal());
    }

    // Radio cards toggle for import mode (Merge vs Replace)
    const optMergeCard = document.getElementById('optMergeCard');
    const optReplaceCard = document.getElementById('optReplaceCard');
    const optMergeRadio = document.getElementById('optMergeTrades');
    const optReplaceRadio = document.getElementById('optReplaceTrades');

    if (optMergeCard && optReplaceCard) {
      optMergeCard.addEventListener('click', () => {
        if (optMergeRadio) optMergeRadio.checked = true;
        optMergeCard.classList.add('selected');
        optReplaceCard.classList.remove('selected');
      });

      optReplaceCard.addEventListener('click', () => {
        if (optReplaceRadio) optReplaceRadio.checked = true;
        optReplaceCard.classList.add('selected');
        optMergeCard.classList.remove('selected');
      });
    }

    // Initialize full-window drag & drop overlay
    this.initWindowDragAndDrop();

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
   * Initialize full-window drag & drop overlay
   */
  initWindowDragAndDrop() {
    if (typeof window === 'undefined') return;

    const overlay = document.getElementById('windowDragOverlay');
    if (!overlay) return;

    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      if (e.dataTransfer && e.dataTransfer.types && (Array.from(e.dataTransfer.types).includes('Files') || e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/x-moz-file'))) {
        dragCounter++;
        overlay.classList.add('active');
      }
    });

    window.addEventListener('dragleave', (e) => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        overlay.classList.remove('active');
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.classList.remove('active');

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv') || file.type.includes('text') || !file.type) {
          this.previewCSVFile(file);
        } else {
          this.showToast('Please drop a valid .csv file.', 'error');
        }
      }
    });
  },

  /**
   * Parse CSV File and open interactive preview modal
   */
  previewCSVFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsedTrades = TradeParser.parseCSV(text);

        if (!parsedTrades || parsedTrades.length === 0) {
          throw new Error('No trade records found in CSV file.');
        }

        // Store pending preview data
        this._pendingImport = {
          file,
          fileName: file.name,
          fileSize: file.size || text.length,
          parsedTrades
        };

        this.showCSVPreviewModal(this._pendingImport);
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
   * Render preview data into the CSV Preview Modal
   */
  showCSVPreviewModal(pending) {
    const modal = document.getElementById('csvPreviewModal');
    if (!modal) return;

    const nameEl = document.getElementById('previewFileName');
    const sizeEl = document.getElementById('previewFileSize');
    const tradesEl = document.getElementById('previewMetricTrades');
    const tradesSubEl = document.getElementById('previewMetricTradesSub');
    const pnlEl = document.getElementById('previewMetricPnL');
    const winRateEl = document.getElementById('previewMetricWinRate');
    const symCountEl = document.getElementById('previewMetricSymbolsCount');
    const symListEl = document.getElementById('previewMetricSymbolsList');
    const dateRangeEl = document.getElementById('previewDateRange');
    const mergeDesc = document.getElementById('previewMergeDesc');
    const optMergeCard = document.getElementById('optMergeCard');
    const optReplaceCard = document.getElementById('optReplaceCard');
    const optMerge = document.getElementById('optMergeTrades');

    // Close regular upload modal if open
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) uploadModal.classList.remove('active');

    // Format file size
    const sizeKb = (pending.fileSize / 1024).toFixed(1);
    if (nameEl) nameEl.innerText = pending.fileName;
    if (sizeEl) sizeEl.innerText = `${sizeKb} KB • ${pending.parsedTrades.length} records`;

    // Compute quick metrics on preview trades
    const metrics = TradeAnalytics.calculateMetrics(pending.parsedTrades);

    if (tradesEl) tradesEl.innerText = `${metrics.totalTrades}`;
    if (tradesSubEl) tradesSubEl.innerText = `${metrics.winnersCount} wins / ${metrics.losersCount} losses`;

    if (pnlEl) {
      pnlEl.innerText = TradeAnalytics.formatCurrency(metrics.totalPnL);
      pnlEl.className = `preview-metric-val ${metrics.totalPnL >= 0 ? 'profit' : 'loss'}`;
    }
    if (winRateEl) winRateEl.innerText = `${metrics.winRate}% win rate`;

    // Symbols detected
    const symbols = metrics.symbolBreakdown ? metrics.symbolBreakdown.map(s => s.symbol) : [];
    if (symCountEl) symCountEl.innerText = `${symbols.length} symbol${symbols.length === 1 ? '' : 's'}`;
    if (symListEl) symListEl.innerText = symbols.slice(0, 4).join(', ') + (symbols.length > 4 ? ` +${symbols.length - 4}` : '');

    // Date range
    if (dateRangeEl) {
      if (metrics.firstTradeDate && metrics.lastTradeDate) {
        dateRangeEl.innerText = `Date range: ${this.formatDateShort(metrics.firstTradeDate)} → ${this.formatDateShort(metrics.lastTradeDate)}`;
      } else {
        dateRangeEl.innerText = `Date range: Single trade session`;
      }
    }

    // Merge options description
    const existingCount = this.trades.length;
    if (existingCount > 0) {
      const makeKey = (t) => `${t.ticket}_${t.closeTime || t.openTime || ''}_${t.lots}_${t.profit}`;
      const seen = new Set(this.trades.map(makeKey));
      let newCount = 0;
      pending.parsedTrades.forEach(t => {
        if (!seen.has(makeKey(t))) newCount++;
      });

      if (mergeDesc) {
        mergeDesc.innerText = `Keep existing ${existingCount} trades untouched and add ${newCount} new trade(s) (Total: ${existingCount + newCount})`;
      }
    } else {
      if (mergeDesc) {
        mergeDesc.innerText = `Import ${pending.parsedTrades.length} trades into your session`;
      }
    }

    // Default to merge (keep existing uploads untouched)
    if (optMerge) optMerge.checked = true;
    if (optMergeCard) optMergeCard.classList.add('selected');
    if (optReplaceCard) optReplaceCard.classList.remove('selected');

    modal.classList.add('active');
  },

  /**
   * Confirm and apply CSV import (merging or replacing)
   */
  confirmCSVImport() {
    if (!this._pendingImport || !this._pendingImport.parsedTrades) {
      this.closeCSVPreviewModal();
      return;
    }

    const { parsedTrades, fileName } = this._pendingImport;
    const optMerge = document.getElementById('optMergeTrades');
    const isMerge = optMerge ? optMerge.checked : true;

    let importedCount = 0;
    if (isMerge && this.trades.length > 0) {
      const res = StorageManager.mergeTrades(parsedTrades, fileName);
      this.trades = res.trades;
      importedCount = res.addedCount;
    } else {
      StorageManager.saveTrades(parsedTrades, fileName);
      this.trades = [...parsedTrades];
      importedCount = parsedTrades.length;
    }

    this.processTrades();
    this.closeCSVPreviewModal();

    this.showToast(`Imported ${importedCount} trades from ${fileName}! (Total: ${this.trades.length})`, 'success');
  },

  closeCSVPreviewModal() {
    const modal = document.getElementById('csvPreviewModal');
    if (modal) modal.classList.remove('active');
    this._pendingImport = null;
  },

  /**
   * Legacy / fallback direct handler
   */
  handleCSVFile(file) {
    this.previewCSVFile(file);
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
  },

  /**
   * Initialize Weekly Performance Filter Dropdowns and Events
   */
  initWeeklyPerformance() {
    const modeBtn = document.getElementById('weeklyPerfModeBtn');
    const modeMenu = document.getElementById('weeklyPerfModeMenu');
    const monthBtn = document.getElementById('weeklyPerfMonthBtn');
    const monthMenu = document.getElementById('weeklyPerfMonthMenu');
    const weekBtn = document.getElementById('weeklyPerfWeekBtn');
    const weekMenu = document.getElementById('weeklyPerfWeekMenu');

    const closeAllWeeklyMenus = () => {
      if (modeMenu) modeMenu.classList.remove('active');
      if (monthMenu) monthMenu.classList.remove('active');
      if (weekMenu) weekMenu.classList.remove('active');
      if (modeBtn) modeBtn.setAttribute('aria-expanded', 'false');
      if (monthBtn) monthBtn.setAttribute('aria-expanded', 'false');
      if (weekBtn) weekBtn.setAttribute('aria-expanded', 'false');
    };

    if (modeBtn && modeMenu) {
      modeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = modeMenu.classList.contains('active');
        closeAllWeeklyMenus();
        if (!isOpen) {
          modeMenu.classList.add('active');
          modeBtn.setAttribute('aria-expanded', 'true');
        }
      });

      modeMenu.querySelectorAll('.weekly-perf-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const mode = item.getAttribute('data-mode') || 'all';
          this.weeklyPerfState.mode = mode;
          closeAllWeeklyMenus();
          this.renderWeeklyPerformance();
        });
      });
    }

    if (monthBtn && monthMenu) {
      monthBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = monthMenu.classList.contains('active');
        closeAllWeeklyMenus();
        if (!isOpen) {
          monthMenu.classList.add('active');
          monthBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    if (weekBtn && weekMenu) {
      weekBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = weekMenu.classList.contains('active');
        closeAllWeeklyMenus();
        if (!isOpen) {
          weekMenu.classList.add('active');
          weekBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    // Close menus on outside click
    document.addEventListener('click', () => {
      closeAllWeeklyMenus();
    });
  },

  /**
   * Extract unique months from trades and compute Sunday-Saturday calendar weeks
   */
  getWeeklyPerfOptions(trades) {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const monthMap = {};
    (trades || []).forEach(t => {
      const dStr = (t.closeTime || t.openTime || '').slice(0, 10);
      if (dStr && dStr.length >= 7) {
        const monthKey = dStr.slice(0, 7); // 'YYYY-MM'
        if (!monthMap[monthKey]) {
          const parts = monthKey.split('-').map(Number);
          const y = parts[0];
          const m = parts[1];
          monthMap[monthKey] = {
            key: monthKey,
            year: y,
            month: m,
            label: `${monthNames[m - 1]} ${y}`,
            tradesCount: 0
          };
        }
        monthMap[monthKey].tradesCount++;
      }
    });

    const months = Object.values(monthMap).sort((a, b) => b.key.localeCompare(a.key));

    return { months, monthNames, monthShortNames };
  },

  /**
   * Generate Sunday -> Saturday calendar weeks for a specific month with trade data
   */
  getWeeksForMonth(year, month, tradesInMonth) {
    const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n) => String(n).padStart(2, '0');
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const weeks = [];
    let currentDay = 1;
    let weekNum = 1;

    while (currentDay <= daysInMonth) {
      const d = new Date(Date.UTC(year, month - 1, currentDay));
      const dayOfWeek = d.getUTCDay(); // 0=Sunday, 6=Saturday
      const daysUntilSat = 6 - dayOfWeek;
      const endDay = Math.min(currentDay + daysUntilSat, daysInMonth);

      const startStr = `${year}-${pad(month)}-${pad(currentDay)}`;
      const endStr = `${year}-${pad(month)}-${pad(endDay)}`;
      const mStr = monthShortNames[month - 1];

      // Check if this week contains any trades
      const hasTrades = (tradesInMonth || []).some(t => {
        const td = (t.closeTime || t.openTime || '').slice(0, 10);
        return td && td >= startStr && td <= endStr;
      });

      if (hasTrades || (tradesInMonth || []).length === 0) {
        weeks.push({
          weekNum,
          weekKey: `${startStr}_${endStr}`,
          startStr,
          endStr,
          label: `Week ${weekNum} (${mStr} ${pad(currentDay)} - ${mStr} ${pad(endDay)})`
        });
      }

      weekNum++;
      currentDay = endDay + 1;
    }

    return weeks;
  },

  /**
   * Render and update the Weekly Performance Filter UI and Chart
   */
  renderWeeklyPerformance() {
    const trades = this.filteredTrades && this.filteredTrades.length > 0 ? this.filteredTrades : this.trades;
    const { months } = this.getWeeklyPerfOptions(trades);

    const modeBtn = document.getElementById('weeklyPerfModeBtn');
    const modeLabel = document.getElementById('weeklyPerfModeLabel');
    const modeMenu = document.getElementById('weeklyPerfModeMenu');
    const monthWrapper = document.getElementById('weeklyPerfMonthWrapper');
    const monthBtn = document.getElementById('weeklyPerfMonthBtn');
    const monthLabel = document.getElementById('weeklyPerfMonthLabel');
    const monthMenu = document.getElementById('weeklyPerfMonthMenu');
    const weekWrapper = document.getElementById('weeklyPerfWeekWrapper');
    const weekBtn = document.getElementById('weeklyPerfWeekBtn');
    const weekLabel = document.getElementById('weeklyPerfWeekLabel');
    const weekMenu = document.getElementById('weeklyPerfWeekMenu');
    const subtitleEl = document.getElementById('weeklyPerfSubtitle');

    const mode = this.weeklyPerfState.mode || 'all';

    // Update active state in mode dropdown
    if (modeMenu) {
      modeMenu.querySelectorAll('.weekly-perf-menu-item').forEach(item => {
        const itemMode = item.getAttribute('data-mode');
        item.classList.toggle('active', itemMode === mode);
      });
    }

    // Set default month if not selected or no longer available
    if (months.length > 0) {
      if (!this.weeklyPerfState.selectedMonth || !months.some(m => m.key === this.weeklyPerfState.selectedMonth)) {
        this.weeklyPerfState.selectedMonth = months[0].key;
      }
    } else {
      this.weeklyPerfState.selectedMonth = null;
    }

    const currentMonthObj = months.find(m => m.key === this.weeklyPerfState.selectedMonth) || (months.length > 0 ? months[0] : null);

    // Populate Month Menu
    if (monthMenu) {
      monthMenu.innerHTML = '';
      months.forEach(m => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `weekly-perf-menu-item ${m.key === this.weeklyPerfState.selectedMonth ? 'active' : ''}`;
        btn.innerText = m.label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.weeklyPerfState.selectedMonth = m.key;
          this.weeklyPerfState.selectedWeek = null; // reset week when month changes
          if (monthMenu) monthMenu.classList.remove('active');
          this.renderWeeklyPerformance();
        });
        monthMenu.appendChild(btn);
      });
    }

    // Compute weeks for selected month
    let weeks = [];
    if (currentMonthObj) {
      const tradesInMonth = (trades || []).filter(t => {
        const dStr = (t.closeTime || t.openTime || '').slice(0, 10);
        return dStr && dStr.startsWith(currentMonthObj.key);
      });
      weeks = this.getWeeksForMonth(currentMonthObj.year, currentMonthObj.month, tradesInMonth);
    }

    // Set default week if not selected or no longer valid
    if (weeks.length > 0) {
      if (!this.weeklyPerfState.selectedWeek || !weeks.some(w => w.weekKey === this.weeklyPerfState.selectedWeek)) {
        this.weeklyPerfState.selectedWeek = weeks[0].weekKey;
        this.weeklyPerfState.weekStart = weeks[0].startStr;
        this.weeklyPerfState.weekEnd = weeks[0].endStr;
      }
    } else {
      this.weeklyPerfState.selectedWeek = null;
      this.weeklyPerfState.weekStart = null;
      this.weeklyPerfState.weekEnd = null;
    }

    const currentWeekObj = weeks.find(w => w.weekKey === this.weeklyPerfState.selectedWeek) || (weeks.length > 0 ? weeks[0] : null);
    if (currentWeekObj) {
      this.weeklyPerfState.weekStart = currentWeekObj.startStr;
      this.weeklyPerfState.weekEnd = currentWeekObj.endStr;
    }

    // Populate Week Menu
    if (weekMenu) {
      weekMenu.innerHTML = '';
      weeks.forEach(w => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `weekly-perf-menu-item ${w.weekKey === this.weeklyPerfState.selectedWeek ? 'active' : ''}`;
        btn.innerText = w.label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.weeklyPerfState.selectedWeek = w.weekKey;
          this.weeklyPerfState.weekStart = w.startStr;
          this.weeklyPerfState.weekEnd = w.endStr;
          if (weekMenu) weekMenu.classList.remove('active');
          this.renderWeeklyPerformance();
        });
        weekMenu.appendChild(btn);
      });
    }

    // Update visibility and labels based on active mode
    if (mode === 'all') {
      if (modeLabel) modeLabel.innerText = 'All Data';
      if (monthWrapper) monthWrapper.style.display = 'none';
      if (weekWrapper) weekWrapper.style.display = 'none';
      if (subtitleEl) subtitleEl.innerText = 'Net P&L by day of the week (All Data)';
    } else if (mode === 'month') {
      if (modeLabel) modeLabel.innerText = 'By Month';
      if (monthWrapper) monthWrapper.style.display = 'inline-block';
      if (weekWrapper) weekWrapper.style.display = 'none';
      if (monthLabel) monthLabel.innerText = currentMonthObj ? currentMonthObj.label : 'Select Month';
      if (subtitleEl) subtitleEl.innerText = currentMonthObj ? `Net P&L by day (${currentMonthObj.label})` : 'Net P&L by day of the week';
    } else if (mode === 'week') {
      if (modeLabel) modeLabel.innerText = 'By Week';
      if (monthWrapper) monthWrapper.style.display = 'inline-block';
      if (weekWrapper) weekWrapper.style.display = 'inline-block';
      if (monthLabel) monthLabel.innerText = currentMonthObj ? currentMonthObj.label : 'Select Month';
      if (weekLabel) weekLabel.innerText = currentWeekObj ? currentWeekObj.label : 'Select Week';
      if (subtitleEl) subtitleEl.innerText = currentWeekObj ? `Net P&L by day (${currentWeekObj.label})` : 'Net P&L by day of the week';
    }

    // Trigger Chart.js render
    if (typeof ChartManager !== 'undefined') {
      ChartManager.renderWeeklyPerformanceChart(trades, {
        mode,
        monthKey: currentMonthObj ? currentMonthObj.key : null,
        weekKey: currentWeekObj ? currentWeekObj.weekKey : null,
        weekStart: this.weeklyPerfState.weekStart,
        weekEnd: this.weeklyPerfState.weekEnd
      });
    }
  }
};

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

if (typeof window !== 'undefined') {
  window.App = App;
}
