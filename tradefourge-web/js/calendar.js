/**
 * TradeFourge - Interactive Monthly Calendar & Dynamic P&L Heatmap Component
 * Progressive 5-Tier Positive/Negative Intensity Scaling Based on Daily P&L %
 */

const CalendarManager = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(), // 0-indexed (0=Jan, 11=Dec)
  metricsData: null,
  containerId: 'calendarGrid',
  titleId: 'calendarTitle',
  pnlPillId: 'calMonthlyPnl',
  daysPillId: 'calMonthlyDays',
  legendNoteId: 'calendarHeatmapLegendNote',
  _listenersAttached: false,
  _scrollHideAttached: false,
  _initialized: false,
  _tooltipEl: null,

  /**
   * Percentage thresholds (% of starting capital) for progressive 5-tier heatmap scaling.
   * Tier 1: (0%, 0.25%)
   * Tier 2: [0.25%, 0.50%)
   * Tier 3: [0.50%, 1.00%)
   * Tier 4: [1.00%, 2.00%)
   * Tier 5: >= 2.00%
   */
  HEATMAP_CONFIG: {
    epsilonPnL: 0.0001,
    positiveThresholds: [0.25, 0.50, 1.00, 2.00],
    negativeThresholds: [0.25, 0.50, 1.00, 2.00],
    missingCapitalFallbackTier: 2
  },

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
    this.attachGlobalHideListeners();
    this.render();
  },

  /**
   * Update metrics and re-render
   */
  update(metrics) {
    if (metrics) {
      this.metricsData = metrics;
    }
    this.hideTooltip();
    this.render();
  },

  /**
   * Resolve valid starting capital in active currency (> 0), or null if unset
   */
  resolveStartingCapital() {
    const fromMetrics = this.metricsData ? Number(this.metricsData.startingCapital) : NaN;
    if (Number.isFinite(fromMetrics) && fromMetrics > 0) {
      return fromMetrics;
    }
    const analytics = (typeof TradeAnalytics !== 'undefined')
      ? TradeAnalytics
      : ((typeof window !== 'undefined') ? window.TradeAnalytics : null);
    if (analytics && typeof analytics.getStartingCapital === 'function') {
      const cap = Number(analytics.getStartingCapital());
      if (Number.isFinite(cap) && cap > 0) {
        return cap;
      }
    }
    return null;
  },

  /**
   * Compute Daily P&L % relative to starting capital: (dailyPnL / startingCapital) * 100
   * Returns null if startingCapital is missing, <= 0, or non-finite.
   */
  computeDailyReturnPercent(dailyPnL, startingCapital) {
    const pnl = Number(dailyPnL);
    const capital = Number(startingCapital);
    if (!Number.isFinite(pnl) || !Number.isFinite(capital) || capital <= 0) {
      return null;
    }
    if (Math.abs(pnl) < this.HEATMAP_CONFIG.epsilonPnL) {
      return 0;
    }
    const pct = (pnl / capital) * 100;
    return Number.isFinite(pct) ? pct : null;
  },

  /**
   * Map daily P&L and Daily P&L % into a symmetric 5-tier intensity classification
   */
  getHeatmapIntensityTier(dailyPnL, dailyPct) {
    const pnl = Number(dailyPnL);
    const eps = this.HEATMAP_CONFIG.epsilonPnL;

    if (!Number.isFinite(pnl) || Math.abs(pnl) < eps) {
      return {
        direction: 'neutral',
        tier: 0,
        className: '',
        hasPercentage: Number.isFinite(Number(dailyPct)) && dailyPct !== null,
        isFallback: false
      };
    }

    const direction = pnl > 0 ? 'pos' : 'neg';
    if (dailyPct === null || dailyPct === undefined || !Number.isFinite(Number(dailyPct))) {
      const fallbackTier = this.HEATMAP_CONFIG.missingCapitalFallbackTier;
      return {
        direction,
        tier: fallbackTier,
        className: `pnl-tier-${direction}-${fallbackTier}`,
        hasPercentage: false,
        isFallback: true
      };
    }

    const absPct = Math.abs(Number(dailyPct));
    const thresholds = direction === 'pos'
      ? this.HEATMAP_CONFIG.positiveThresholds
      : this.HEATMAP_CONFIG.negativeThresholds;

    let tier = 5;
    if (absPct < thresholds[0]) {
      tier = 1;
    } else if (absPct < thresholds[1]) {
      tier = 2;
    } else if (absPct < thresholds[2]) {
      tier = 3;
    } else if (absPct < thresholds[3]) {
      tier = 4;
    } else {
      tier = 5;
    }

    return {
      direction,
      tier,
      className: `pnl-tier-${direction}-${tier}`,
      hasPercentage: true,
      isFallback: false
    };
  },

  /**
   * Format Daily P&L % consistently (e.g., '+1.42%', '-0.85%', '0.00%', 'N/A')
   */
  formatPercent(pct) {
    if (pct === null || pct === undefined || !Number.isFinite(Number(pct))) {
      return 'N/A';
    }
    const num = Number(pct);
    if (Math.abs(num) < 0.0005) {
      return '0.00%';
    }
    const sign = num > 0 ? '+' : '-';
    return `${sign}${Math.abs(num).toFixed(2)}%`;
  },

  /**
   * Format YYYY-MM-DD cleanly for tooltips and modals
   */
  formatDateDisplay(dateKey) {
    if (!dateKey || typeof dateKey !== 'string') return '';
    const parts = dateKey.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return dateKey;
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${shortDays[d.getUTCDay()]}, ${shortMonths[d.getUTCMonth()]} ${parts[2]}, ${parts[0]}`;
  },

  /**
   * Escape HTML special characters safely
   */
  escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
          App.showToast('Heatmap intensity scales daily P&L % of Starting Capital across 5 gain/loss tiers', 'info');
        }
      });
    }

    this._listenersAttached = true;
  },

  /**
   * Hide floating tooltip on container/window scroll or escape
   */
  attachGlobalHideListeners() {
    if (this._scrollHideAttached || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    const hideHandler = () => this.hideTooltip();
    window.addEventListener('scroll', hideHandler, true);
    window.addEventListener('resize', hideHandler);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideHandler();
    });
    this._scrollHideAttached = true;
  },

  /**
   * Ensure singleton floating tooltip element exists
   */
  ensureTooltipElement() {
    if (typeof document === 'undefined') return null;
    if (this._tooltipEl && document.body.contains(this._tooltipEl)) {
      return this._tooltipEl;
    }
    let existing = document.getElementById('calHeatmapTooltip');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'calHeatmapTooltip';
      existing.className = 'cal-heatmap-tooltip';
      existing.setAttribute('role', 'tooltip');
      existing.setAttribute('aria-hidden', 'true');
      document.body.appendChild(existing);
    }
    this._tooltipEl = existing;
    return existing;
  },

  /**
   * Hover tooltips belong strictly to pointer/hover desktop viewports, never mobile/touch
   */
  supportsHoverTooltip() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        return false;
      }
    }
    if (typeof App !== 'undefined' && typeof App.isMobileViewport === 'function' && App.isMobileViewport()) {
      return false;
    }
    return true;
  },

  /**
   * Show and position tooltip for a specific trading day cell
   */
  showTooltipForCell(cell, info) {
    if (!this.supportsHoverTooltip()) {
      this.hideTooltip();
      return;
    }
    const tooltip = this.ensureTooltipElement();
    if (!tooltip || !cell || !info) return;

    const pnlClass = info.pnl > 0 ? 'profit' : (info.pnl < 0 ? 'loss' : 'neutral');
    const tierBadgeClass = info.direction === 'pos' ? 'profit' : (info.direction === 'neg' ? 'loss' : '');
    let tierText = 'Flat (0%)';
    if (info.direction === 'pos' || info.direction === 'neg') {
      if (!info.hasPercentage) {
        tierText = 'No Capital Set';
      } else {
        const tierLabels = ['', 'Small', 'Mild', 'Moderate', 'Strong', 'High'];
        const sign = info.direction === 'pos' ? '+' : '-';
        tierText = `Tier ${sign}${info.tier} (${tierLabels[info.tier]})`;
      }
    }

    const footText = info.hasPercentage
      ? 'Click cell to inspect daily trades'
      : 'Set Starting Capital to scale % tiers • Click to inspect';

    tooltip.innerHTML = `
      <div class="cal-tooltip-header">
        <span class="cal-tooltip-date">${this.escapeHtml(info.dateDisplay)}</span>
        <span class="cal-tooltip-tier-pill ${tierBadgeClass}">${this.escapeHtml(tierText)}</span>
      </div>
      <div class="cal-tooltip-rows">
        <div class="cal-tooltip-row">
          <span class="cal-tooltip-lbl">Total Trades</span>
          <span class="cal-tooltip-val">${info.trades}</span>
        </div>
        <div class="cal-tooltip-row">
          <span class="cal-tooltip-lbl">Winning Trades</span>
          <span class="cal-tooltip-val profit">${info.wins}</span>
        </div>
        <div class="cal-tooltip-row">
          <span class="cal-tooltip-lbl">Losing Trades</span>
          <span class="cal-tooltip-val loss">${info.losses}</span>
        </div>
        <div class="cal-tooltip-row">
          <span class="cal-tooltip-lbl">Net P&amp;L</span>
          <span class="cal-tooltip-val ${pnlClass}">${this.escapeHtml(info.pnlFormatted)}</span>
        </div>
        <div class="cal-tooltip-row">
          <span class="cal-tooltip-lbl">Daily P&amp;L %</span>
          <span class="cal-tooltip-val ${pnlClass}">${this.escapeHtml(info.pctFormatted)}</span>
        </div>
      </div>
      <div class="cal-tooltip-foot">${this.escapeHtml(footText)}</div>
    `;

    tooltip.setAttribute('aria-hidden', 'false');
    tooltip.classList.add('visible');

    // Measure and clamp within viewport
    const cellRect = cell.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const margin = 8;

    let left = cellRect.left + (cellRect.width / 2) - (tipRect.width / 2);
    left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));

    let top = cellRect.top - tipRect.height - 10;
    if (top < margin) {
      top = cellRect.bottom + 10;
    }
    if (top + tipRect.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - tipRect.height - margin);
    }

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  },

  /**
   * Hide floating heatmap tooltip
   */
  hideTooltip() {
    if (!this._tooltipEl) return;
    this._tooltipEl.classList.remove('visible');
    this._tooltipEl.setAttribute('aria-hidden', 'true');
  },

  /**
   * Navigate to previous month
   */
  prevMonth() {
    this.hideTooltip();
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
    this.hideTooltip();
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
    this.hideTooltip();
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
   * Update the explanatory legend note under the calendar grid
   */
  updateLegendNote(startingCapital, analytics) {
    const noteEl = document.getElementById(this.legendNoteId);
    if (!noteEl) return;

    if (startingCapital && startingCapital > 0) {
      const capText = analytics ? analytics.formatCurrency(startingCapital, false) : `$${startingCapital}`;
      noteEl.textContent = `Heatmap scaled by daily P&L % of ${capText} capital (<0.25% to >=2.00%)`;
    } else {
      noteEl.textContent = 'Set Starting Capital in ROI card or Settings to scale intensity by exact daily P&L %';
    }
  },

  /**
   * Render calendar grid, monthly header stats, heatmap tiers, tooltips, and weekly cards
   */
  render() {
    const gridEl = document.getElementById(this.containerId);
    const titleEl = document.getElementById(this.titleId);
    const pnlPillEl = document.getElementById(this.pnlPillId);
    const daysPillEl = document.getElementById(this.daysPillId);

    if (!gridEl || !titleEl) return;

    this.hideTooltip();

    const analytics = (typeof TradeAnalytics !== 'undefined')
      ? TradeAnalytics
      : ((typeof window !== 'undefined') ? window.TradeAnalytics : null);

    const monthNames = (analytics && analytics.MONTH_NAMES)
      ? analytics.MONTH_NAMES
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

    const startingCapital = this.resolveStartingCapital();
    this.updateLegendNote(startingCapital, analytics);

    // 2. Prepare Calendar Weekday Dimensions
    const firstDayIndex = new Date(this.currentYear, this.currentMonth, 1).getDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(this.currentYear, this.currentMonth, 0).getDate();

    const totalSlots = firstDayIndex + daysInMonth;
    const totalWeeks = totalSlots <= 35 ? 5 : 6;

    const dailyMap = (this.metricsData && this.metricsData.dailyMap) ? this.metricsData.dailyMap : {};
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

            const pnl = Number(dayData.pnl) || 0;
            const dailyPct = this.computeDailyReturnPercent(pnl, startingCapital);
            const intensity = this.getHeatmapIntensityTier(pnl, dailyPct);

            const tradeWord = `<span class="trade-count-num">${dayData.trades}</span><span class="trade-count-word"> ${dayData.trades === 1 ? 'trade' : 'trades'}</span>`;
            const tradeTitleWord = dayData.trades === 1 ? '1 trade' : `${dayData.trades} trades`;

            let pnlDisplay = '';
            if (intensity.direction === 'pos') {
              const valFormatted = Math.abs(pnl).toFixed(0) === '0' ? Math.abs(pnl).toFixed(2) : Math.abs(pnl).toFixed(0);
              cell.classList.add('profit-day', 'has-trades');
              if (intensity.className) cell.classList.add(intensity.className);
              pnlDisplay = `+${sym}${valFormatted}`;
            } else if (intensity.direction === 'neg') {
              const valFormatted = Math.abs(pnl).toFixed(0) === '0' ? Math.abs(pnl).toFixed(2) : Math.abs(pnl).toFixed(0);
              cell.classList.add('loss-day', 'has-trades');
              if (intensity.className) cell.classList.add(intensity.className);
              pnlDisplay = `-${sym}${valFormatted}`;
            } else {
              cell.classList.add('breakeven-day', 'has-trades');
              pnlDisplay = `${sym}0.00`;
            }

            cell.setAttribute('data-date-key', dateKey);
            cell.setAttribute('data-pnl-tier', intensity.className || 'neutral');
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('role', 'button');

            const wins = Number.isFinite(Number(dayData.wins))
              ? Number(dayData.wins)
              : (Array.isArray(dayData.tradeList) ? dayData.tradeList.filter(t => (Number(t.profit) || 0) > 0).length : 0);
            const losses = Number.isFinite(Number(dayData.losses))
              ? Number(dayData.losses)
              : (Array.isArray(dayData.tradeList) ? dayData.tradeList.filter(t => (Number(t.profit) || 0) < 0).length : 0);

            const fullFormatted = analytics ? analytics.formatCurrency(pnl, true) : pnlDisplay;
            const pctFormatted = this.formatPercent(dailyPct);
            const dateDisplay = this.formatDateDisplay(dateKey);

            cell.setAttribute(
              'aria-label',
              `${dateDisplay}: Net P&L ${fullFormatted}, Daily P&L ${pctFormatted}, ${tradeTitleWord} (${wins} winning, ${losses} losing)`
            );

            cell.innerHTML = `
              <div class="day-header-line"><span class="day-number">${dayNum}</span></div>
              <div class="day-pnl-wrap">
                <div class="day-pnl">${pnlDisplay}</div>
                <div class="day-trade-count">${tradeWord}</div>
              </div>
            `;

            const tooltipInfo = {
              dateKey,
              dateDisplay,
              trades: dayData.trades,
              wins,
              losses,
              pnl,
              pnlFormatted: fullFormatted,
              dailyPct,
              pctFormatted,
              direction: intensity.direction,
              tier: intensity.tier,
              hasPercentage: intensity.hasPercentage
            };

            if (this.supportsHoverTooltip()) {
              cell.addEventListener('mouseenter', () => this.showTooltipForCell(cell, tooltipInfo));
              cell.addEventListener('focus', () => this.showTooltipForCell(cell, tooltipInfo));
              cell.addEventListener('mouseleave', () => this.hideTooltip());
              cell.addEventListener('blur', () => this.hideTooltip());
            }

            const openModal = () => {
              this.hideTooltip();
              if (typeof App !== 'undefined' && App.openDayTradesModal) {
                App.openDayTradesModal(dateKey, dayData);
              }
            };

            cell.addEventListener('click', openModal);
            cell.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openModal();
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
