/**
 * TradeForge - Interactive Monthly Calendar Component
 */

const CalendarManager = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(), // 0-indexed (0=Jan, 11=Dec)
  metricsData: null,
  containerId: 'calendarGrid',
  titleId: 'calendarTitle',

  /**
   * Initialize calendar with metrics
   */
  init(metrics) {
    this.metricsData = metrics;

    // Default to the latest month containing trades, if available
    if (metrics.lastTradeDate) {
      const parts = metrics.lastTradeDate.split('-');
      if (parts.length >= 2) {
        this.currentYear = parseInt(parts[0], 10);
        this.currentMonth = parseInt(parts[1], 10) - 1;
      }
    }

    this.render();
  },

  /**
   * Update metrics and re-render
   */
  update(metrics) {
    this.metricsData = metrics;
    this.render();
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
   * Render calendar grid
   */
  render() {
    const gridEl = document.getElementById(this.containerId);
    const titleEl = document.getElementById(this.titleId);
    if (!gridEl || !titleEl) return;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    titleEl.innerText = `${monthNames[this.currentMonth]} ${this.currentYear}`;

    gridEl.innerHTML = '';

    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(d => {
      const headEl = document.createElement('div');
      headEl.className = 'calendar-weekday';
      headEl.innerText = d;
      gridEl.appendChild(headEl);
    });

    const firstDayIndex = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(this.currentYear, this.currentMonth, 0).getDate();

    const dailyMap = (this.metricsData && this.metricsData.dailyMap) ? this.metricsData.dailyMap : {};

    // Previous month padding cells
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const padCell = document.createElement('div');
      padCell.className = 'calendar-day-cell other-month';
      padCell.innerHTML = `<span class="day-number">${prevMonthDays - i}</span>`;
      gridEl.appendChild(padCell);
    }

    // Current month cells
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell';

      const monthStr = String(this.currentMonth + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${this.currentYear}-${monthStr}-${dayStr}`;

      const dayData = dailyMap[dateKey];

      if (dayData && dayData.trades > 0) {
        const pnl = dayData.pnl;
        const tradeWord = dayData.trades === 1 ? '1 trade' : `${dayData.trades} trades`;

        if (pnl > 0) {
          cell.classList.add('profit-day');
          cell.innerHTML = `
            <span class="day-number">${day}</span>
            <div class="day-pnl-wrap">
              <div class="day-pnl">+${Math.abs(pnl).toFixed(0) === '0' ? '$' + pnl.toFixed(2) : '$' + Math.abs(pnl).toFixed(0)}</div>
              <div class="day-trade-count">${tradeWord}</div>
            </div>
          `;
        } else if (pnl < 0) {
          cell.classList.add('loss-day');
          cell.innerHTML = `
            <span class="day-number">${day}</span>
            <div class="day-pnl-wrap">
              <div class="day-pnl">-${Math.abs(pnl).toFixed(0) === '0' ? '$' + Math.abs(pnl).toFixed(2) : '$' + Math.abs(pnl).toFixed(0)}</div>
              <div class="day-trade-count">${tradeWord}</div>
            </div>
          `;
        } else {
          cell.classList.add('breakeven-day');
          cell.innerHTML = `
            <span class="day-number">${day}</span>
            <div class="day-pnl-wrap">
              <div class="day-pnl">$0.00</div>
              <div class="day-trade-count">${tradeWord}</div>
            </div>
          `;
        }

        cell.setAttribute('title', `${dateKey}: ${TradeAnalytics.formatCurrency(pnl)} (${tradeWord})`);
        cell.addEventListener('click', () => {
          App.openDayTradesModal(dateKey, dayData);
        });
      } else {
        cell.innerHTML = `<span class="day-number">${day}</span>`;
      }

      gridEl.appendChild(cell);
    }

    // Remaining slots to complete 35 or 42 grid cells
    const totalCellsSoFar = firstDayIndex + daysInMonth;
    const remaining = (totalCellsSoFar <= 35) ? 35 - totalCellsSoFar : 42 - totalCellsSoFar;

    for (let j = 1; j <= remaining; j++) {
      const padCell = document.createElement('div');
      padCell.className = 'calendar-day-cell other-month';
      padCell.innerHTML = `<span class="day-number">${j}</span>`;
      gridEl.appendChild(padCell);
    }
  }
};

