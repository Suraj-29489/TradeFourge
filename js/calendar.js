/**
 * TradeForge - Interactive Monthly Calendar Component
 * Institutional Terminal Edition with Weekly Performance & Monthly Stats
 */

const CalendarManager = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(), // 0-indexed (0=Jan, 11=Dec)
  metricsData: null,
  containerId: 'calendarGrid',
  titleId: 'calendarTitle',
  pnlPillId: 'calMonthlyPnl',
  daysPillId: 'calMonthlyDays',
  _listenersAttached: false,
  _initialized: false,

  /**
   * Initialize calendar with metrics
   */
  init(metrics, forceReset = false) {
    this.metricsData = metrics;

    // Default to the latest month containing trades, if available and not yet initialized
    if ((!this._initialized || forceReset) && metrics && metrics.lastTradeDate) {
      const parts = metrics.lastTradeDate.split('-');
      if (parts.length >= 2) {
        this.currentYear = parseInt(parts[0], 10);
        this.currentMonth = parseInt(parts[1], 10) - 1;
      }
      this._initialized = true;
    }

    this.attachHeaderListeners();
    this.render();
  },

  /**
   * Update metrics and re-render
   */
  update(metrics) {
    if (metrics) {
      this.metricsData = metrics;
    }
    this.render();
  },

  /**
   * Attach button listeners once
   */
  attachHeaderListeners() {
    if (this._listenersAttached) return;

    const prevBtn = document.getElementById('calPrevBtn');
    const nextBtn = document.getElementById('calNextBtn');
    const todayBtn = document.getElementById('calThisMonthBtn');
    const settingsBtn = document.getElementById('calSettingsBtn');
    const infoBtn = document.getElementById('calInfoBtn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevMonth());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextMonth());
    }
    if (todayBtn) {
      todayBtn.addEventListener('click', () => this.thisMonth());
    }
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Calendar Accounting: Realized P&L in Asia/Kolkata (IST)', 'info');
        }
      });
    }
    if (infoBtn) {
      infoBtn.addEventListener('click', () => {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Weekly summaries calculate distinct trading days and net P&L per row', 'info');
        }
      });
    }

    this._listenersAttached = true;
  },

  /**
   * Navigate to previous month
   */
  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.render();
  },

  /**
   * Navigate to next month
   */
  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.render();
  },

  /**
   * Jump to current calendar month ("This month")
   */
  thisMonth() {
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth();
    this.render();
  },

  /**
   * Calculate monthly net P&L and distinct trading days
   */
  getMonthlyStats() {
    const dailyMap = (this.metricsData && this.metricsData.dailyMap) ? this.metricsData.dailyMap : {};
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    let netPnL = 0;
    let tradingDays = 0;
    let totalTrades = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(this.currentMonth + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${this.currentYear}-${monthStr}-${dayStr}`;

      const dayData = dailyMap[dateKey];
      if (dayData && dayData.trades > 0) {
        netPnL += dayData.pnl;
        tradingDays += 1;
        totalTrades += dayData.trades;
      }
    }

    netPnL = Math.round(netPnL * 100) / 100;
    return { netPnL, tradingDays, totalTrades };
  },

  /**
   * Format P&L with consistent currency symbol and sign
   */
  formatPnL(value, withDecimals = false) {
    const analytics = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics : ((typeof window !== 'undefined') ? window.TradeAnalytics : null);
    if (analytics) {
      return analytics.formatCurrency(value, true);
    }
    const num = Number(value) || 0;
    const sign = num > 0 ? '+' : (num < 0 ? '-' : '');
    const sym = analytics ? analytics.getCurrencySymbol() : '$';
    const absVal = Math.abs(num);
    const formatted = withDecimals ? absVal.toFixed(2) : (absVal % 1 === 0 ? absVal.toFixed(0) : absVal.toFixed(2));
    return `${sign}${sym}${formatted}`;
  },

  /**
   * Render calendar grid, monthly header stats, and weekly cards
   */
  render() {
    const gridEl = document.getElementById(this.containerId);
    const titleEl = document.getElementById(this.titleId);
    const pnlPillEl = document.getElementById(this.pnlPillId);
    const daysPillEl = document.getElementById(this.daysPillId);

    if (!gridEl || !titleEl) return;

    const monthNames = (typeof TradeAnalytics !== 'undefined' && TradeAnalytics.MONTH_NAMES)
      ? TradeAnalytics.MONTH_NAMES
      : [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];

    titleEl.innerText = `${monthNames[this.currentMonth]} ${this.currentYear}`;

    // 1. Calculate & Render Monthly Header Stats
    const monthStats = this.getMonthlyStats();

    if (pnlPillEl) {
      pnlPillEl.innerText = this.formatPnL(monthStats.netPnL, true);
      pnlPillEl.className = `cal-stat-pill cal-stat-pnl ${monthStats.netPnL > 0 ? 'profit' : (monthStats.netPnL < 0 ? 'loss' : 'neutral')}`;
    }

    if (daysPillEl) {
      daysPillEl.innerText = `${monthStats.tradingDays} ${monthStats.tradingDays === 1 ? 'day' : 'days'}`;
    }

    // 2. Prepare Calendar Weekday Dimensions
    const firstDayIndex = new Date(this.currentYear, this.currentMonth, 1).getDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(this.currentYear, this.currentMonth, 0).getDate();

    const totalSlots = firstDayIndex + daysInMonth;
    const totalWeeks = totalSlots <= 35 ? 5 : 6;

    const dailyMap = (this.metricsData && this.metricsData.dailyMap) ? this.metricsData.dailyMap : {};
    const analytics = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics : ((typeof window !== 'undefined') ? window.TradeAnalytics : null);
    const sym = analytics ? analytics.getCurrencySymbol() : '$';

    gridEl.innerHTML = '';

    // 3. Render Weekday Header Row (Sun - Sat + Weekly Summary column)
    const headerRow = document.createElement('div');
    headerRow.className = 'calendar-week-row calendar-header-row';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(d => {
      const headEl = document.createElement('div');
      headEl.className = 'calendar-weekday';
      headEl.innerText = d;
      headerRow.appendChild(headEl);
    });

    const weeklyHeadEl = document.createElement('div');
    weeklyHeadEl.className = 'calendar-weekday calendar-weekday-summary';
    weeklyHeadEl.innerText = 'Weekly';
    headerRow.appendChild(weeklyHeadEl);

    gridEl.appendChild(headerRow);

    // 4. Render Each Week Row (7 Day Cells + 1 Weekly Summary Card)
    for (let w = 0; w < totalWeeks; w++) {
      const weekRow = document.createElement('div');
      weekRow.className = 'calendar-week-row';

      let weekPnL = 0;
      let weekTradingDays = 0;
      let weekTrades = 0;

      // Render 7 Day Cells for this week
      for (let col = 0; col < 7; col++) {
        const slotIndex = w * 7 + col;
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell';

        if (slotIndex < firstDayIndex) {
          // Previous month padding cell
          const padDay = prevMonthDays - (firstDayIndex - 1 - slotIndex);
          cell.classList.add('other-month');
          cell.innerHTML = `
            <div class="day-header-line"><span class="day-number">${padDay}</span></div>
            <div class="day-pnl-wrap"><div class="day-pnl empty-pnl"></div></div>
          `;
        } else if (slotIndex >= firstDayIndex + daysInMonth) {
          // Next month padding cell
          const padDay = slotIndex - (firstDayIndex + daysInMonth) + 1;
          cell.classList.add('other-month');
          cell.innerHTML = `
            <div class="day-header-line"><span class="day-number">${padDay}</span></div>
            <div class="day-pnl-wrap"><div class="day-pnl empty-pnl"></div></div>
          `;
        } else {
          // Active month day cell
          const dayNum = slotIndex - firstDayIndex + 1;
          const monthStr = String(this.currentMonth + 1).padStart(2, '0');
          const dayStr = String(dayNum).padStart(2, '0');
          const dateKey = `${this.currentYear}-${monthStr}-${dayStr}`;

          const dayData = dailyMap[dateKey];

          if (dayData && dayData.trades > 0) {
            weekPnL += dayData.pnl;
            weekTradingDays += 1;
            weekTrades += dayData.trades;

            const pnl = dayData.pnl;
            const tradeWord = `<span class="trade-count-num">${dayData.trades}</span><span class="trade-count-word"> ${dayData.trades === 1 ? 'trade' : 'trades'}</span>`;
            const tradeTitleWord = dayData.trades === 1 ? '1 trade' : `${dayData.trades} trades`;

            let pnlDisplay = '';
            if (pnl > 0) {
              const valFormatted = Math.abs(pnl).toFixed(0) === '0' ? Math.abs(pnl).toFixed(2) : Math.abs(pnl).toFixed(0);
              cell.classList.add('profit-day');
              pnlDisplay = `+${sym}${valFormatted}`;
            } else if (pnl < 0) {
              const valFormatted = Math.abs(pnl).toFixed(0) === '0' ? Math.abs(pnl).toFixed(2) : Math.abs(pnl).toFixed(0);
              cell.classList.add('loss-day');
              pnlDisplay = `-${sym}${valFormatted}`;
            } else {
              cell.classList.add('breakeven-day');
              pnlDisplay = `${sym}0.00`;
            }

            cell.innerHTML = `
              <div class="day-header-line"><span class="day-number">${dayNum}</span></div>
              <div class="day-pnl-wrap">
                <div class="day-pnl">${pnlDisplay}</div>
                <div class="day-trade-count">${tradeWord}</div>
              </div>
            `;

            const fullFormatted = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.formatCurrency(pnl) : pnlDisplay;
            cell.setAttribute('title', `${dateKey}: ${fullFormatted} (${tradeTitleWord})`);

            cell.addEventListener('click', () => {
              if (typeof App !== 'undefined' && App.openDayTradesModal) {
                App.openDayTradesModal(dateKey, dayData);
              }
            });
          } else {
            // Day without trades
            cell.innerHTML = `
              <div class="day-header-line"><span class="day-number">${dayNum}</span></div>
              <div class="day-pnl-wrap"><div class="day-pnl empty-pnl"></div></div>
            `;
          }
        }

        weekRow.appendChild(cell);
      }

      // Render 8th Column: Weekly Summary Card
      weekPnL = Math.round(weekPnL * 100) / 100;
      const summaryCell = document.createElement('div');
      summaryCell.className = 'calendar-week-summary-cell';

      let pnlClass = 'neutral';
      let pnlFormattedText = `${sym}0`;

      if (weekPnL > 0) {
        summaryCell.classList.add('profit-week');
        pnlClass = 'profit';
        pnlFormattedText = this.formatPnL(weekPnL, false);
      } else if (weekPnL < 0) {
        summaryCell.classList.add('loss-week');
        pnlClass = 'loss';
        pnlFormattedText = this.formatPnL(weekPnL, false);
      } else {
        summaryCell.classList.add('empty-week');
        pnlClass = 'neutral';
        pnlFormattedText = `${sym}0`;
      }

      const daysWord = `${weekTradingDays} ${weekTradingDays === 1 ? 'day' : 'days'}`;

      summaryCell.innerHTML = `
        <div class="week-summary-inner">
          <div class="week-summary-label">Week ${w + 1}</div>
          <div class="week-summary-pnl ${pnlClass}">${pnlFormattedText}</div>
          <div class="week-summary-days">
            <span class="week-days-pill">${daysWord}</span>
          </div>
        </div>
      `;

      weekRow.appendChild(summaryCell);
      gridEl.appendChild(weekRow);
    }
  }
};

if (typeof window !== 'undefined') {
  window.CalendarManager = CalendarManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CalendarManager;
}
