/**
 * TradeForge - Chart.js Visualizations Manager
 */

const ChartManager = {
  instances: {
    tradesDonut: null,
    daysDonut: null,
    pnlMain: null,
    weeklyPerformance: null,
    pnlPerformance: null,
    symbolBar: null,
    weekdayBar: null,
    durationDist: null,
    lotSizeBar: null
  },

  currentPnLView: 'cumulative', // 'cumulative' or 'daily'
  currentLotView: 'pnl', // 'pnl' or 'trades'

  /**
   * Render or update all charts from calculated metrics
   */
  updateDashboardCharts(metrics) {
    this.renderTradesDonut(metrics);
    this.renderDaysDonut(metrics);
    this.renderMainPnLChart(metrics);
  },

  /**
   * Render Winning % by Trades Donut Chart
   */
  renderTradesDonut(metrics) {
    const ctx = document.getElementById('tradesDonutCanvas');
    if (!ctx) return;

    if (this.instances.tradesDonut) {
      this.instances.tradesDonut.destroy();
    }

    const wins = metrics.winnersCount || 0;
    const losses = metrics.losersCount || 0;
    const hasData = (wins + losses) > 0;

    const dataValues = hasData ? [wins, losses] : [1];
    const backgroundColors = hasData ? ['#10b981', '#f43f5e'] : ['#262e45'];

    this.instances.tradesDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: dataValues,
          backgroundColor: backgroundColors,
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '76%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasData,
            callbacks: {
              label: (context) => {
                const label = context.dataIndex === 0 ? 'Winners' : 'Losers';
                return ` ${label}: ${context.raw} trades`;
              }
            }
          }
        }
      }
    });

    // Update center label
    const labelEl = document.getElementById('tradesDonutCenterVal');
    if (labelEl) {
      labelEl.innerText = `${metrics.winRate}%`;
      labelEl.style.color = metrics.winRate >= 50 ? '#10b981' : '#f43f5e';
    }
  },

  /**
   * Render Winning % by Days Donut Chart
   */
  renderDaysDonut(metrics) {
    const ctx = document.getElementById('daysDonutCanvas');
    if (!ctx) return;

    if (this.instances.daysDonut) {
      this.instances.daysDonut.destroy();
    }

    const wins = metrics.winningDaysCount || 0;
    const losses = metrics.losingDaysCount || 0;
    const hasData = (wins + losses) > 0;

    const dataValues = hasData ? [wins, losses] : [1];
    const backgroundColors = hasData ? ['#10b981', '#f43f5e'] : ['#262e45'];

    this.instances.daysDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: dataValues,
          backgroundColor: backgroundColors,
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '76%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasData,
            callbacks: {
              label: (context) => {
                const label = context.dataIndex === 0 ? 'Winning Days' : 'Losing Days';
                return ` ${label}: ${context.raw} days`;
              }
            }
          }
        }
      }
    });

    // Update center label
    const labelEl = document.getElementById('daysDonutCenterVal');
    if (labelEl) {
      labelEl.innerText = `${metrics.dayWinRate}%`;
      labelEl.style.color = metrics.dayWinRate >= 50 ? '#10b981' : '#f43f5e';
    }
  },

  /**
   * Render Main P&L Chart (Cumulative Line, Daily Bar, or Weekly Bar)
   */
  renderMainPnLChart(metrics) {
    const ctx = document.getElementById('pnlMainCanvas');
    if (!ctx) return;

    if (this.instances.pnlMain) {
      this.instances.pnlMain.destroy();
      this.instances.pnlMain = null;
    }
    const existing = Chart.getChart(ctx);
    if (existing) {
      existing.destroy();
    }

    const subtextEl = document.getElementById('pnlChartSubtext');

    if (this.currentPnLView === 'cumulative') {
      if (subtextEl) subtextEl.innerText = 'Realized Equity Growth';
      const timeseries = metrics.cumulativeTimeseries || [];

      const labels = timeseries.map(t => {
        const parts = t.date.split('-');
        if (parts.length === 3) {
          return `${parts[1]}/${parts[2]}/${parts[0].slice(2)}`;
        }
        return t.date;
      });

      const values = timeseries.map(t => t.cumulativePnL);

      this.instances.pnlMain = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Cumulative Net P&L',
            data: values,
            borderColor: '#10b981',
            borderWidth: 2.5,
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.25,
            pointRadius: values.length > 30 ? 0 : 3.5,
            pointHoverRadius: 6,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#181d2c',
              titleColor: '#94a3b8',
              bodyColor: '#ffffff',
              borderColor: '#262e45',
              borderWidth: 1,
              padding: 12,
              displayColors: false,
              callbacks: {
                title: (items) => `Date: ${items[0].label}`,
                label: (item) => {
                  const val = item.raw;
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  const prefix = val >= 0 ? `+${sym}` : `-${sym}`;
                  return `Cumulative P&L: ${prefix}${Math.abs(val).toFixed(2)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(38, 46, 69, 0.5)', drawBorder: false },
              ticks: { color: '#64748b', font: { size: 11 }, maxTicksLimit: 8 }
            },
            y: {
              grid: { color: 'rgba(38, 46, 69, 0.5)', drawBorder: false },
              ticks: {
                color: '#64748b',
                font: { size: 11 },
                callback: (val) => {
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  return `${sym}${val}`;
                }
              }
            }
          }
        }
      });
    } else if (this.currentPnLView === 'weekly') {
      if (subtextEl) subtextEl.innerText = 'Week-by-Week Net Profit / Loss';
      const timeseries = metrics.weeklyTimeseries || [];

      const labels = timeseries.map(t => t.shortLabel || t.label || t.weekStart);
      const values = timeseries.map(t => t.weeklyPnL);
      const barColors = values.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(244, 63, 94, 0.85)');
      const borderColors = values.map(v => v >= 0 ? '#10b981' : '#f43f5e');

      this.instances.pnlMain = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Weekly Net P&L',
            data: values,
            backgroundColor: barColors,
            borderColor: borderColors,
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#181d2c',
              titleColor: '#94a3b8',
              bodyColor: '#ffffff',
              borderColor: '#262e45',
              borderWidth: 1,
              padding: 12,
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  const item = timeseries[idx];
                  return item ? `Week: ${item.label}` : items[0].label;
                },
                label: (item) => {
                  const idx = item.dataIndex;
                  const tData = timeseries[idx];
                  const val = item.raw;
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  const prefix = val >= 0 ? `+${sym}` : `-${sym}`;
                  const tradeInfo = tData ? ` (${tData.trades} trades: ${tData.wins}W / ${tData.losses}L)` : '';
                  return `Weekly Net P&L: ${prefix}${Math.abs(val).toFixed(2)}${tradeInfo}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(38, 46, 69, 0.3)', drawBorder: false },
              ticks: { color: '#64748b', font: { size: 11 }, maxTicksLimit: 10 }
            },
            y: {
              grid: { color: 'rgba(38, 46, 69, 0.5)', drawBorder: false },
              ticks: {
                color: '#64748b',
                font: { size: 11 },
                callback: (val) => {
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  return `${sym}${val}`;
                }
              }
            }
          }
        }
      });
    } else if (this.currentPnLView === 'monthly') {
      if (subtextEl) subtextEl.innerText = 'Month-by-Month Net Profit / Loss';
      const timeseries = metrics.monthlyTimeseries || [];

      const labels = timeseries.map(t => t.label);
      const values = timeseries.map(t => t.monthlyPnL);
      const barColors = values.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(244, 63, 94, 0.85)');
      const borderColors = values.map(v => v >= 0 ? '#10b981' : '#f43f5e');

      this.instances.pnlMain = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Monthly Net P&L',
            data: values,
            backgroundColor: barColors,
            borderColor: borderColors,
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#181d2c',
              titleColor: '#94a3b8',
              bodyColor: '#ffffff',
              borderColor: '#262e45',
              borderWidth: 1,
              padding: 12,
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  const item = timeseries[idx];
                  return item ? (item.fullLabel || item.label) : items[0].label;
                },
                label: (item) => {
                  const idx = item.dataIndex;
                  const tData = timeseries[idx];
                  const val = item.raw;
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  const prefix = val >= 0 ? `+${sym}` : `-${sym}`;
                  const lines = [
                    `Net P&L: ${prefix}${Math.abs(val).toFixed(2)}`
                  ];
                  if (tData) {
                    lines.push(`Trades: ${tData.trades}`);
                    lines.push(`Wins: ${tData.wins}`);
                    lines.push(`Losses: ${tData.losses}`);
                    lines.push(`Win rate: ${tData.winRate}%`);
                  }
                  return lines;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(38, 46, 69, 0.3)', drawBorder: false },
              ticks: { color: '#64748b', font: { size: 11 }, maxTicksLimit: 12 }
            },
            y: {
              grid: { color: 'rgba(38, 46, 69, 0.5)', drawBorder: false },
              ticks: {
                color: '#64748b',
                font: { size: 11 },
                callback: (val) => {
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  return `${sym}${val}`;
                }
              }
            }
          }
        }
      });
    } else {
      // Bar Chart for Daily P&L
      if (subtextEl) subtextEl.innerText = 'Day-by-Day Net Profit / Loss';
      const timeseries = metrics.dailyTimeseries || [];

      const labels = timeseries.map(t => {
        const parts = t.date.split('-');
        if (parts.length === 3) {
          return `${parts[1]}/${parts[2]}/${parts[0].slice(2)}`;
        }
        return t.date;
      });

      const values = timeseries.map(t => t.dailyPnL);
      const barColors = values.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(244, 63, 94, 0.85)');
      const borderColors = values.map(v => v >= 0 ? '#10b981' : '#f43f5e');

      this.instances.pnlMain = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Daily Net P&L',
            data: values,
            backgroundColor: barColors,
            borderColor: borderColors,
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#181d2c',
              titleColor: '#94a3b8',
              bodyColor: '#ffffff',
              borderColor: '#262e45',
              borderWidth: 1,
              padding: 12,
              callbacks: {
                label: (item) => {
                  const val = item.raw;
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  const prefix = val >= 0 ? `+${sym}` : `-${sym}`;
                  return `Daily P&L: ${prefix}${Math.abs(val).toFixed(2)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(38, 46, 69, 0.5)', drawBorder: false },
              ticks: { color: '#64748b', font: { size: 11 }, maxTicksLimit: 8 }
            },
            y: {
              grid: { color: 'rgba(38, 46, 69, 0.5)', drawBorder: false },
              ticks: {
                color: '#64748b',
                font: { size: 11 },
                callback: (val) => {
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  return `${sym}${val}`;
                }
              }
            }
          }
        }
      });
    }
  },

  /**
   * Render Dashboard Weekly Performance 7-Day Bar Chart (Sunday -> Saturday)
   */
  renderWeeklyPerformanceChart(trades = [], filterConfig = { mode: 'all' }) {
    const canvas = document.getElementById('weeklyPerformanceCanvas');
    const emptyEl = document.getElementById('weeklyPerfEmpty');
    const canvasWrap = document.getElementById('weeklyPerfCanvasWrap');
    if (!canvas) return;

    if (this.instances.weeklyPerformance) {
      this.instances.weeklyPerformance.destroy();
      this.instances.weeklyPerformance = null;
    }

    if (!trades || trades.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      if (canvasWrap) canvasWrap.style.display = 'none';
      return;
    }

    // 1. Filter trades based on filterConfig
    let scopedTrades = trades;
    if (filterConfig.mode === 'month' && filterConfig.monthKey) {
      scopedTrades = trades.filter(t => {
        const dStr = (t.closeTime || t.openTime || '').slice(0, 10);
        return dStr && dStr.startsWith(filterConfig.monthKey);
      });
    } else if (filterConfig.mode === 'week' && filterConfig.weekStart && filterConfig.weekEnd) {
      scopedTrades = trades.filter(t => {
        const dStr = (t.closeTime || t.openTime || '').slice(0, 10);
        return dStr && dStr >= filterConfig.weekStart && dStr <= filterConfig.weekEnd;
      });
    }

    // 2. Aggregate P&L across 7 fixed weekdays: Sunday (0) to Saturday (6)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayShortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const buckets = [0, 1, 2, 3, 4, 5, 6].map(i => ({
      dayIndex: i,
      dayName: dayNames[i],
      shortName: dayShortNames[i],
      pnl: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      breakEven: 0
    }));

    scopedTrades.forEach(trade => {
      const dateStr = (trade.closeTime || trade.openTime || '').slice(0, 10);
      if (!dateStr || dateStr.length < 10) return;
      const parts = dateStr.split('-').map(Number);
      if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return;

      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      const dayOfWeek = d.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      const pnl = Number(trade.profit) || 0;

      buckets[dayOfWeek].pnl += pnl;
      buckets[dayOfWeek].trades += 1;
      if (pnl > 0) buckets[dayOfWeek].wins += 1;
      else if (pnl < 0) buckets[dayOfWeek].losses += 1;
      else buckets[dayOfWeek].breakEven += 1;
    });

    const totalTradesInScope = buckets.reduce((acc, b) => acc + b.trades, 0);
    if (totalTradesInScope === 0 && filterConfig.mode !== 'all') {
      if (emptyEl) emptyEl.style.display = 'flex';
      if (canvasWrap) canvasWrap.style.display = 'none';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (canvasWrap) canvasWrap.style.display = 'block';

    const values = buckets.map(b => Math.round(b.pnl * 100) / 100);
    const barColors = values.map(v => v > 0 ? 'rgba(16, 185, 129, 0.85)' : (v < 0 ? 'rgba(244, 63, 94, 0.85)' : 'rgba(100, 116, 139, 0.35)'));
    const borderColors = values.map(v => v > 0 ? '#10b981' : (v < 0 ? '#f43f5e' : '#64748b'));
    const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';

    this.instances.weeklyPerformance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: dayShortNames,
        datasets: [{
          label: `Net P&L (${sym})`,
          data: values,
          backgroundColor: barColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 48
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#181d2c',
            titleColor: '#94a3b8',
            bodyColor: '#ffffff',
            borderColor: '#262e45',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return buckets[idx].dayName;
              },
              label: (item) => {
                const idx = item.dataIndex;
                const b = buckets[idx];
                const val = item.raw;
                const sign = val > 0 ? '+' : (val < 0 ? '-' : '');
                const formattedPnl = `${sign}${sym}${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                const lines = [
                  `Net P&L: ${formattedPnl}`,
                  `Trades: ${b.trades}`
                ];
                if (b.trades > 0) {
                  lines.push(`Wins: ${b.wins}`);
                  lines.push(`Losses: ${b.losses}`);
                  if (b.breakEven > 0) {
                    lines.push(`Break Even: ${b.breakEven}`);
                  }
                }
                return lines;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(38, 46, 69, 0.3)', drawBorder: false },
            ticks: { color: '#94a3b8', font: { size: 12, weight: '600' } }
          },
          y: {
            grid: { color: 'rgba(38, 46, 69, 0.5)', drawBorder: false },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: (val) => {
                const isNeg = val < 0;
                return `${isNeg ? '-' : ''}${sym}${Math.abs(val)}`;
              }
            }
          }
        }
      }
    });
  },

  /**
   * Render Dashboard Bottommost P&L Performance Line Chart (P&L Over Time)
   */
  renderPnLPerformanceChart(trades = [], filterConfig = { mode: 'all' }) {
    const canvas = document.getElementById('pnlPerformanceCanvas');
    const emptyEl = document.getElementById('pnlPerfEmpty');
    const canvasWrap = document.getElementById('pnlPerfCanvasWrap');
    if (!canvas) return;

    if (this.instances.pnlPerformance) {
      this.instances.pnlPerformance.destroy();
      this.instances.pnlPerformance = null;
    }
    const existing = Chart.getChart(canvas);
    if (existing) {
      existing.destroy();
    }

    if (!trades || trades.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      if (canvasWrap) canvasWrap.style.display = 'none';
      return;
    }

    // 1. Filter trades based on filterConfig
    let scopedTrades = trades;
    if (filterConfig.mode === 'monthly' && filterConfig.selectedMonth) {
      scopedTrades = trades.filter(t => {
        const dStr = (t.closeTime || t.openTime || '').slice(0, 7);
        return dStr === filterConfig.selectedMonth;
      });
    } else if (filterConfig.mode === 'yearly' && filterConfig.selectedYear) {
      scopedTrades = trades.filter(t => {
        const dStr = (t.closeTime || t.openTime || '').slice(0, 4);
        return dStr === String(filterConfig.selectedYear);
      });
    } else if (filterConfig.mode === 'custom') {
      const start = filterConfig.customStart;
      const end = filterConfig.customEnd;
      scopedTrades = trades.filter(t => {
        const dStr = (t.closeTime || t.openTime || '').slice(0, 10);
        return dStr && (!start || dStr >= start) && (!end || dStr <= end);
      });
    }

    if (scopedTrades.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      if (canvasWrap) canvasWrap.style.display = 'none';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (canvasWrap) canvasWrap.style.display = 'block';

    // 2. Sort chronologically
    const sortedTrades = [...scopedTrades].sort((a, b) => {
      const da = new Date(a.closeTime || a.openTime || 0).getTime();
      const db = new Date(b.closeTime || b.openTime || 0).getTime();
      return da - db;
    });

    // 3. Group by unique date (YYYY-MM-DD)
    const dailyMap = {};
    sortedTrades.forEach(t => {
      const dStr = (t.closeTime || t.openTime || '').slice(0, 10);
      if (!dStr || dStr.length < 10) return;
      if (!dailyMap[dStr]) {
        dailyMap[dStr] = { date: dStr, pnl: 0, count: 0, wins: 0, losses: 0 };
      }
      const pnl = Number(t.profit) || 0;
      dailyMap[dStr].pnl += pnl;
      dailyMap[dStr].count += 1;
      if (pnl > 0) dailyMap[dStr].wins += 1;
      else if (pnl < 0) dailyMap[dStr].losses += 1;
    });

    const dateKeys = Object.keys(dailyMap).sort();
    if (dateKeys.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      if (canvasWrap) canvasWrap.style.display = 'none';
      return;
    }

    let runningCum = 0;
    const timeseries = dateKeys.map(d => {
      const dayData = dailyMap[d];
      runningCum += dayData.pnl;
      const parts = d.split('-');
      const shortLabel = parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
      return {
        date: d,
        shortLabel,
        dailyPnL: Math.round(dayData.pnl * 100) / 100,
        cumulativePnL: Math.round(runningCum * 100) / 100,
        trades: dayData.count,
        wins: dayData.wins,
        losses: dayData.losses
      };
    });

    const labels = timeseries.map(t => t.shortLabel);
    const values = timeseries.map(t => t.cumulativePnL);
    const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
    const finalVal = values[values.length - 1] || 0;
    const isNetPositive = finalVal >= 0;
    const lineColor = isNetPositive ? '#10b981' : '#f43f5e';
    const pointColor = isNetPositive ? '#10b981' : '#f43f5e';

    const ctx = canvas.getContext('2d');
    let gradient = isNetPositive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)';
    try {
      gradient = ctx.createLinearGradient(0, 0, 0, 260);
      if (isNetPositive) {
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');
      } else {
        gradient.addColorStop(0, 'rgba(244, 63, 94, 0.25)');
        gradient.addColorStop(1, 'rgba(244, 63, 94, 0.00)');
      }
    } catch (e) {
      gradient = isNetPositive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)';
    }

    this.instances.pnlPerformance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `Cumulative Net P&L (${sym})`,
          data: values,
          borderColor: lineColor,
          borderWidth: 2.5,
          backgroundColor: gradient,
          fill: true,
          tension: 0.25,
          pointRadius: values.length > 35 ? 0 : 3.5,
          pointHoverRadius: 6,
          pointBackgroundColor: pointColor,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#181d2c',
            titleColor: '#94a3b8',
            bodyColor: '#ffffff',
            borderColor: '#262e45',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                const item = timeseries[idx];
                return item ? `Date: ${item.date}` : items[0].label;
              },
              label: (item) => {
                const idx = item.dataIndex;
                const tData = timeseries[idx];
                const cumVal = item.raw;
                const cumPrefix = cumVal > 0 ? '+' : (cumVal < 0 ? '-' : '');
                const formattedCum = `${cumPrefix}${sym}${Math.abs(cumVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                
                const dailyVal = tData ? tData.dailyPnL : 0;
                const dailyPrefix = dailyVal > 0 ? '+' : (dailyVal < 0 ? '-' : '');
                const formattedDaily = `${dailyPrefix}${sym}${Math.abs(dailyVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                return [
                  `Cumulative P&L: ${formattedCum}`,
                  `Day P&L: ${formattedDaily} (${tData ? tData.trades : 0} trades)`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(38, 46, 69, 0.35)', drawBorder: false },
            ticks: { color: '#94a3b8', font: { size: 11 }, maxTicksLimit: 10 }
          },
          y: {
            grid: { color: 'rgba(38, 46, 69, 0.5)', drawBorder: false },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: (val) => {
                const isNeg = val < 0;
                return `${isNeg ? '-' : ''}${sym}${Math.abs(val)}`;
              }
            }
          }
        }
      }
    });
  },

  /**
   * Render Reports View Charts (Symbol breakdown & Day of Week)
   */
  renderReportsCharts(metrics) {
    this.renderSymbolBarChart(metrics);
    this.renderWeekdayChart(metrics);
  },

  renderSymbolBarChart(metrics) {
    const ctx = document.getElementById('symbolBarCanvas');
    if (!ctx) return;

    if (this.instances.symbolBar) {
      this.instances.symbolBar.destroy();
    }

    const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
    const symbols = (metrics.symbolBreakdown || []).slice(0, 8);
    const labels = symbols.map(s => s.symbol);
    const pnls = symbols.map(s => s.pnl);
    const colors = pnls.map(p => p >= 0 ? '#10b981' : '#f43f5e');

    this.instances.symbolBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: `Net P&L (${sym})`,
          data: pnls,
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#181d2c',
            borderColor: '#262e45',
            borderWidth: 1,
            callbacks: {
              label: (item) => `P&L: ${sym}${item.raw.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(38, 46, 69, 0.5)' },
            ticks: { color: '#64748b', callback: v => `${sym}${v}` }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#f8fafc', font: { weight: '600' } }
          }
        }
      }
    });
  },

  renderWeekdayChart(metrics) {
    const ctx = document.getElementById('weekdayBarCanvas');
    if (!ctx) return;

    if (this.instances.weekdayBar) {
      this.instances.weekdayBar.destroy();
    }

    const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const dayIndices = [1, 2, 3, 4, 5];
    const data = dayIndices.map(idx => Math.round((metrics.weekdayMap[idx] || 0) * 100) / 100);
    const colors = data.map(d => d >= 0 ? '#10b981' : '#f43f5e');

    this.instances.weekdayBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dayLabels,
        datasets: [{
          label: `Net P&L (${sym})`,
          data,
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#181d2c',
            borderColor: '#262e45',
            borderWidth: 1,
            callbacks: {
              label: (item) => `Net P&L: ${sym}${item.raw.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#f8fafc', font: { weight: '600' } }
          },
          y: {
            grid: { color: 'rgba(38, 46, 69, 0.5)' },
            ticks: { color: '#64748b', callback: v => `${sym}${v}` }
          }
        }
      }
    });
  },

  /**
   * Render or update all Analytics charts
   */
  updateAnalyticsCharts(metrics) {
    if (!metrics) return;
    this.renderDurationChart(metrics.durationMetrics);
    this.renderLotSizeChart(metrics.lotMetrics, this.currentLotView);
  },

  /**
   * Render Trade Duration Distribution Chart
   */
  renderDurationChart(durationMetrics) {
    const ctx = document.getElementById('durationDistCanvas');
    if (!ctx) return;

    if (this.instances.durationDist) {
      this.instances.durationDist.destroy();
      this.instances.durationDist = null;
    }

    if (!durationMetrics || !durationMetrics.hasData || !durationMetrics.distribution || durationMetrics.distribution.length === 0) {
      return;
    }

    const dist = durationMetrics.distribution;
    const labels = dist.map(d => d.label);
    const winData = dist.map(d => d.wins);
    const lossData = dist.map(d => d.losses);

    this.instances.durationDist = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Winners',
            data: winData,
            backgroundColor: '#10b981',
            borderRadius: 4,
            stack: 'trades'
          },
          {
            label: 'Losers',
            data: lossData,
            backgroundColor: '#f43f5e',
            borderRadius: 4,
            stack: 'trades'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              color: '#94a3b8',
              font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" }
            }
          },
          tooltip: {
            backgroundColor: '#181d2c',
            borderColor: '#262e45',
            borderWidth: 1,
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8',
            padding: 10,
            callbacks: {
              afterBody: (tooltipItems) => {
                const idx = tooltipItems[0]?.dataIndex;
                if (idx !== undefined && dist[idx]) {
                  const d = dist[idx];
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  const sign = d.pnl >= 0 ? '+' : '-';
                  return `Total: ${d.trades} trades | Win Rate: ${d.winRate}%\nNet P&L: ${sign}${sym}${Math.abs(d.pnl).toFixed(2)}`;
                }
                return '';
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              color: '#94a3b8',
              font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" }
            }
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(38, 46, 69, 0.4)', drawBorder: false },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              precision: 0
            }
          }
        }
      }
    });
  },

  /**
   * Render Trade Size / Lot Analysis Chart
   */
  renderLotSizeChart(lotMetrics, mode = 'pnl') {
    this.currentLotView = mode;
    const ctx = document.getElementById('lotSizeBarCanvas');
    if (!ctx) return;

    if (this.instances.lotSizeBar) {
      this.instances.lotSizeBar.destroy();
      this.instances.lotSizeBar = null;
    }

    if (!lotMetrics || !lotMetrics.hasData || !lotMetrics.lotBreakdown || lotMetrics.lotBreakdown.length === 0) {
      return;
    }

    const groups = lotMetrics.lotBreakdown;
    const labels = groups.map(g => `${g.lotLabel} lots`);

    if (mode === 'trades') {
      const counts = groups.map(g => g.trades);
      this.instances.lotSizeBar = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Trade Count',
            data: counts,
            backgroundColor: '#6366f1',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#181d2c',
              borderColor: '#262e45',
              borderWidth: 1,
              callbacks: {
                label: (item) => `Trades: ${item.raw}`,
                afterLabel: (item) => {
                  const g = groups[item.dataIndex];
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  const sign = g.netPnL >= 0 ? '+' : '-';
                  return `Win Rate: ${g.winRate}% | Net: ${sign}${sym}${Math.abs(g.netPnL).toFixed(2)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8', font: { size: 11 } }
            },
            y: {
              grid: { color: 'rgba(38, 46, 69, 0.4)', drawBorder: false },
              ticks: { color: '#64748b', font: { size: 11 }, precision: 0 }
            }
          }
        }
      });
    } else {
      // Default: P&L by Lot Size
      const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
      const pnls = groups.map(g => g.netPnL);
      const bgColors = pnls.map(p => p >= 0 ? '#10b981' : '#f43f5e');

      this.instances.lotSizeBar = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: `Net P&L (${sym})`,
            data: pnls,
            backgroundColor: bgColors,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#181d2c',
              borderColor: '#262e45',
              borderWidth: 1,
              callbacks: {
                label: (item) => {
                  const val = item.raw;
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  const sign = val >= 0 ? '+' : '-';
                  return ` Net P&L: ${sign}${sym}${Math.abs(val).toFixed(2)}`;
                },
                afterLabel: (item) => {
                  const g = groups[item.dataIndex];
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  return `Trades: ${g.trades} | Win Rate: ${g.winRate}% | Avg: ${sym}${g.avgPnL.toFixed(2)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8', font: { size: 11 } }
            },
            y: {
              grid: { color: 'rgba(38, 46, 69, 0.4)', drawBorder: false },
              ticks: {
                color: '#64748b',
                font: { size: 11 },
                callback: (v) => {
                  const sym = (typeof TradeAnalytics !== 'undefined') ? TradeAnalytics.getCurrencySymbol() : '$';
                  return `${sym}${v}`;
                }
              }
            }
          }
        }
      });
    }
  }
};

if (typeof window !== 'undefined') {
  window.ChartManager = ChartManager;
}
