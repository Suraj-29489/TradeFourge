/**
 * TradeForge - Chart.js Visualizations Manager
 */

const ChartManager = {
  instances: {
    tradesDonut: null,
    daysDonut: null,
    pnlMain: null,
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
                  const prefix = val >= 0 ? '+$' : '-$';
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
                callback: (val) => `$${val}`
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
                  const prefix = val >= 0 ? '+$' : '-$';
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
                callback: (val) => `$${val}`
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
                  const prefix = val >= 0 ? '+$' : '-$';
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
                callback: (val) => `$${val}`
              }
            }
          }
        }
      });
    }
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

    const symbols = (metrics.symbolBreakdown || []).slice(0, 8);
    const labels = symbols.map(s => s.symbol);
    const pnls = symbols.map(s => s.pnl);
    const colors = pnls.map(p => p >= 0 ? '#10b981' : '#f43f5e');

    this.instances.symbolBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Net P&L ($)',
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
              label: (item) => `P&L: $${item.raw.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(38, 46, 69, 0.5)' },
            ticks: { color: '#64748b', callback: v => `$${v}` }
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

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const dayIndices = [1, 2, 3, 4, 5];
    const data = dayIndices.map(idx => Math.round((metrics.weekdayMap[idx] || 0) * 100) / 100);
    const colors = data.map(d => d >= 0 ? '#10b981' : '#f43f5e');

    this.instances.weekdayBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dayLabels,
        datasets: [{
          label: 'Net P&L ($)',
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
              label: (item) => `Net P&L: $${item.raw.toFixed(2)}`
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
            ticks: { color: '#64748b', callback: v => `$${v}` }
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
                  const sign = d.pnl >= 0 ? '+' : '-';
                  return `Total: ${d.trades} trades | Win Rate: ${d.winRate}%\nNet P&L: ${sign}$${Math.abs(d.pnl).toFixed(2)}`;
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
                  const sign = g.netPnL >= 0 ? '+' : '-';
                  return `Win Rate: ${g.winRate}% | Net: ${sign}$${Math.abs(g.netPnL).toFixed(2)}`;
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
      const pnls = groups.map(g => g.netPnL);
      const bgColors = pnls.map(p => p >= 0 ? '#10b981' : '#f43f5e');

      this.instances.lotSizeBar = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Net P&L ($)',
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
                  const sign = val >= 0 ? '+' : '-';
                  return ` Net P&L: ${sign}$${Math.abs(val).toFixed(2)}`;
                },
                afterLabel: (item) => {
                  const g = groups[item.dataIndex];
                  return `Trades: ${g.trades} | Win Rate: ${g.winRate}% | Avg: $${g.avgPnL.toFixed(2)}`;
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
                callback: (v) => `$${v}`
              }
            }
          }
        }
      });
    }
  }
};
