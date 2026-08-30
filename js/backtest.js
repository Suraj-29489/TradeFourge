/**
 * TradeForge - Strategy Backtesting Engine & Multi-Tab Performance Dashboard
 * Supports persistent backtest history (#001, #002...), Equity & Drawdown curves,
 * Monthly Performance analysis, Trade Distribution, and Full Execution Log.
 */

const BacktestEngine = {
  STORAGE_KEY: 'tradeforge_backtest_history',
  equityChartInstance: null,
  drawdownChartInstance: null,
  monthlyChartInstance: null,
  distributionChartInstance: null,
  overviewEquityChartInstance: null,

  history: [],
  currentBacktest: null,
  activeTab: 'configuration', // 'configuration', 'overview', 'equity', 'trades', 'analysis'

  /**
   * Initialize Backtest Engine, load history, bind UI events
   */
  init() {
    this.loadHistory();
    this.bindEvents();
    this.renderHistoryList();

    // If there is existing history, load the most recent one, otherwise stay on configuration
    if (this.history.length > 0) {
      this.loadBacktest(this.history[0].id, false);
      this.switchTab('overview');
    } else {
      this.switchTab('configuration');
    }
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    const runBtn = document.getElementById('btnRunBacktest');
    if (runBtn) {
      runBtn.addEventListener('click', () => this.runBacktest());
    }

    const newBtBtn = document.getElementById('btnNewBacktest');
    if (newBtBtn) {
      newBtBtn.addEventListener('click', () => {
        this.switchTab('configuration');
        document.getElementById('backtestConfigCard')?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const clearHistBtn = document.getElementById('btnClearBacktestHistory');
    if (clearHistBtn) {
      clearHistBtn.addEventListener('click', () => this.clearHistory());
    }

    const importBtn = document.getElementById('btnImportBacktestToJournal');
    if (importBtn) {
      importBtn.addEventListener('click', () => this.importToJournal());
    }

    const exportBtn = document.getElementById('btnExportBacktestCSV');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportCSV());
    }

    const strategySelect = document.getElementById('backtestStrategy');
    if (strategySelect) {
      strategySelect.addEventListener('change', (e) => this.onStrategyChange(e.target.value));
    }

    // Tab buttons
    document.querySelectorAll('.bt-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });

    // Trades search in Backtest
    const tradeSearchInput = document.getElementById('btTradesSearch');
    if (tradeSearchInput) {
      tradeSearchInput.addEventListener('input', (e) => {
        if (this.currentBacktest) {
          this.renderTradesTable(this.currentBacktest.trades, e.target.value);
        }
      });
    }
  },

  /**
   * Load history from localStorage (or auto-seed sample backtests)
   */
  loadHistory() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      this.history = data ? JSON.parse(data) : [];

      if (this.history.length === 0) {
        // Pre-seed sample backtests so it is immediately usable out-of-the-box
        const cfg1 = {
          strategy: 'ema_crossover',
          strategyName: 'EMA 9/21 + EMA 50',
          symbol: 'XAUUSD',
          timeframe: 'M15',
          startDate: '2025-01-01',
          endDate: '2026-08-30',
          initialCapital: 1000,
          lotSize: 0.01,
          leverage: 200,
          spread: 20,
          commission: 0.0,
          slippage: 0.0,
          fastEma: 9,
          slowEma: 21,
          trendEma: 50,
          stopLossAtr: 1.5,
          takeProfitAtr: 2.0
        };

        const res1 = this.simulate(cfg1);
        res1.id = '#001';
        res1.timestamp = new Date(Date.now() - 3600000).toISOString();
        this.history.push(res1);
        this.saveHistory();
      }
    } catch (e) {
      console.warn('Could not read backtest history:', e);
      this.history = [];
    }
  },

  /**
   * Save history to localStorage
   */
  saveHistory() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.history));
    } catch (e) {
      console.warn('Could not save backtest history:', e);
    }
  },

  /**
   * Clear all backtest history
   */
  clearHistory() {
    if (confirm('Are you sure you want to clear all saved backtest history?')) {
      this.history = [];
      this.currentBacktest = null;
      this.saveHistory();
      this.renderHistoryList();
      this.switchTab('configuration');
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('Backtest history cleared.', 'success');
      }
    }
  },

  /**
   * Delete specific backtest from history
   */
  deleteBacktest(id, e) {
    if (e) e.stopPropagation();
    this.history = this.history.filter(h => h.id !== id);
    this.saveHistory();
    this.renderHistoryList();

    if (this.currentBacktest && this.currentBacktest.id === id) {
      if (this.history.length > 0) {
        this.loadBacktest(this.history[0].id);
      } else {
        this.currentBacktest = null;
        this.switchTab('configuration');
      }
    }
  },

  /**
   * Switch Active Result / Navigation Tab
   */
  switchTab(tabName) {
    this.activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.bt-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Update sub-views
    document.querySelectorAll('.bt-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `btPane-${tabName}`);
    });

    // Render charts on tab switch to ensure proper sizing
    if (this.currentBacktest) {
      if (tabName === 'overview') {
        setTimeout(() => this.renderOverviewEquityChart(this.currentBacktest.equityCurve), 50);
      } else if (tabName === 'equity') {
        setTimeout(() => {
          this.renderEquityChart(this.currentBacktest.equityCurve);
          this.renderDrawdownChart(this.currentBacktest.drawdownCurve);
        }, 50);
      } else if (tabName === 'analysis') {
        setTimeout(() => {
          this.renderMonthlyChart(this.currentBacktest.monthlyPerformance);
          this.renderDistributionChart(this.currentBacktest);
        }, 50);
      }
    }
  },

  /**
   * Handle strategy template preset change
   */
  onStrategyChange(strategy) {
    const fastEmaEl = document.getElementById('btFastEma');
    const slowEmaEl = document.getElementById('btSlowEma');
    const trendEmaEl = document.getElementById('btTrendEma');
    const slEl = document.getElementById('btStopLoss');
    const tpEl = document.getElementById('btTakeProfit');

    if (strategy === 'ema_crossover') {
      if (fastEmaEl) fastEmaEl.value = 9;
      if (slowEmaEl) slowEmaEl.value = 21;
      if (trendEmaEl) trendEmaEl.value = 50;
      if (slEl) slEl.value = '1.5';
      if (tpEl) tpEl.value = '2.0';
    } else if (strategy === 'trend_pullback') {
      if (fastEmaEl) fastEmaEl.value = 20;
      if (slowEmaEl) slowEmaEl.value = 50;
      if (trendEmaEl) trendEmaEl.value = 200;
      if (slEl) slEl.value = '2.0';
      if (tpEl) tpEl.value = '3.0';
    } else if (strategy === 'scalping') {
      if (fastEmaEl) fastEmaEl.value = 5;
      if (slowEmaEl) slowEmaEl.value = 13;
      if (trendEmaEl) trendEmaEl.value = 34;
      if (slEl) slEl.value = '1.0';
      if (tpEl) tpEl.value = '1.5';
    }
  },

  /**
   * Execute Backtesting Simulation
   */
  runBacktest() {
    const runBtn = document.getElementById('btnRunBacktest');
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.innerHTML = `
        <svg class="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
        </svg>
        Simulating Backtest...
      `;
    }

    setTimeout(() => {
      try {
        const config = this.getFormConfig();
        const results = this.simulate(config);

        // Generate sequential ID (#001, #002, etc.)
        const nextNum = this.history.length + 1;
        const id = `#${String(nextNum).padStart(3, '0')}`;
        results.id = id;
        results.timestamp = new Date().toISOString();

        this.currentBacktest = results;
        this.history.unshift(results);
        this.saveHistory();

        this.renderHistoryList();
        this.renderAllTabs(results);
        this.switchTab('overview');

        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast(`Backtest ${id} completed! (${results.returnPct >= 0 ? '+' : ''}${results.returnPct.toFixed(1)}% Return)`, 'success');
        }
      } catch (err) {
        console.error('Backtest error:', err);
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast('Backtest failed: ' + err.message, 'error');
        }
      } finally {
        if (runBtn) {
          runBtn.disabled = false;
          runBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            RUN BACKTEST
          `;
        }
      }
    }, 450);
  },

  /**
   * Retrieve all configuration form values
   */
  getFormConfig() {
    const getVal = (id, fallback) => {
      const el = document.getElementById(id);
      return el ? el.value : fallback;
    };

    const getNum = (id, fallback) => {
      const el = document.getElementById(id);
      const val = el ? parseFloat(el.value) : fallback;
      return isNaN(val) ? fallback : val;
    };

    const stratVal = getVal('backtestStrategy', 'ema_crossover');
    const fastEma = getNum('btFastEma', 9);
    const slowEma = getNum('btSlowEma', 21);
    const trendEma = getNum('btTrendEma', 50);

    let stratLabel = `EMA ${fastEma}/${slowEma}`;
    if (trendEma) stratLabel += ` + EMA ${trendEma}`;

    return {
      strategy: stratVal,
      strategyName: stratLabel,
      symbol: getVal('backtestSymbol', 'XAUUSD').toUpperCase(),
      timeframe: getVal('backtestTimeframe', 'M15'),
      startDate: getVal('backtestStartDate', '2025-01-01'),
      endDate: getVal('backtestEndDate', '2026-08-30'),
      initialCapital: getNum('backtestInitialCapital', 1000),
      lotSize: getNum('backtestLotSize', 0.01),
      leverage: getNum('backtestLeverage', 200),
      spread: getNum('backtestSpread', 20),
      commission: getNum('backtestCommission', 0.0),
      slippage: getNum('backtestSlippage', 0.0),
      fastEma,
      slowEma,
      trendEma,
      stopLossAtr: getNum('btStopLoss', 1.5),
      takeProfitAtr: getNum('btTakeProfit', 2.0)
    };
  },

  /**
   * High-Fidelity Market Simulation & Strategy Backtest Engine
   */
  simulate(config) {
    const symbol = config.symbol;
    const basePriceMap = {
      XAUUSD: 2750.0,
      BTCUSD: 68500.0,
      EURUSD: 1.0850,
      GBPUSD: 1.2850,
      GBPJPY: 198.50,
      ETHUSD: 2650.0,
      US30: 39500.0,
      NAS100: 19800.0
    };

    const basePrice = basePriceMap[symbol] || 100.0;
    const pointValue = symbol.includes('USD') && !symbol.startsWith('EUR') && !symbol.startsWith('GBP') ? 1.0 : (symbol === 'EURUSD' || symbol === 'GBPUSD' ? 100000 : 100);

    const start = new Date(config.startDate);
    const end = new Date(config.endDate);
    const totalDays = Math.max(30, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const totalBars = Math.min(800, Math.max(120, totalDays * 2));

    // Generate price series with realistic multi-month trends and volatility cycles
    const bars = [];
    let currentPrice = basePrice;
    let trendDirection = 1;

    for (let i = 0; i < totalBars; i++) {
      const progress = i / totalBars;
      const barTime = new Date(start.getTime() + progress * (end.getTime() - start.getTime()));

      if (i % 42 === 0) {
        trendDirection = Math.random() > 0.40 ? 1 : -1;
      }

      const dailyVolatility = (basePrice * (symbol === 'BTCUSD' ? 0.025 : (symbol === 'XAUUSD' ? 0.012 : 0.006)));
      const delta = (trendDirection * dailyVolatility * 0.45) + ((Math.random() - 0.47) * dailyVolatility);
      
      const open = currentPrice;
      const close = Math.max(basePrice * 0.4, open + delta);
      const high = Math.max(open, close) + Math.random() * dailyVolatility * 0.5;
      const low = Math.min(open, close) - Math.random() * dailyVolatility * 0.5;
      currentPrice = close;

      bars.push({
        time: barTime.toISOString(),
        dateStr: barTime.toISOString().slice(0, 10),
        monthStr: barTime.toISOString().slice(0, 7), // YYYY-MM
        dayOfWeek: barTime.getDay(),
        open,
        high,
        low,
        close
      });
    }

    // Calculate Indicators (Fast EMA, Slow EMA, Trend EMA, ATR)
    const fastPeriod = Math.max(2, config.fastEma);
    const slowPeriod = Math.max(fastPeriod + 1, config.slowEma);
    const trendPeriod = Math.max(slowPeriod + 1, config.trendEma);

    const fastEma = this.calcEMA(bars.map(b => b.close), fastPeriod);
    const slowEma = this.calcEMA(bars.map(b => b.close), slowPeriod);
    const trendEma = this.calcEMA(bars.map(b => b.close), trendPeriod);
    const atr = this.calcATR(bars, 14);

    // Run trade simulation
    let capital = config.initialCapital;
    let peakCapital = capital;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;

    const trades = [];
    let activeTrade = null;
    const equityCurve = [{ date: config.startDate, equity: capital, pnl: 0 }];
    const drawdownCurve = [{ date: config.startDate, drawdownPct: 0 }];

    for (let i = trendPeriod; i < bars.length; i++) {
      const bar = bars[i];
      const currentAtr = atr[i] || (bar.close * 0.01);

      // Check exit for active trade
      if (activeTrade) {
        let isClosed = false;
        let exitPrice = bar.close;
        let closeReason = 'Signal Crossover';

        if (activeTrade.type === 'buy') {
          if (bar.low <= activeTrade.stopLoss) {
            exitPrice = activeTrade.stopLoss;
            closeReason = 'Stop Loss (SL)';
            isClosed = true;
          } else if (bar.high >= activeTrade.takeProfit) {
            exitPrice = activeTrade.takeProfit;
            closeReason = 'Take Profit (TP)';
            isClosed = true;
          } else if (fastEma[i] < slowEma[i] && fastEma[i - 1] >= slowEma[i - 1]) {
            exitPrice = bar.close;
            closeReason = 'EMA Cross Exit';
            isClosed = true;
          }
        } else {
          if (bar.high >= activeTrade.stopLoss) {
            exitPrice = activeTrade.stopLoss;
            closeReason = 'Stop Loss (SL)';
            isClosed = true;
          } else if (bar.low <= activeTrade.takeProfit) {
            exitPrice = activeTrade.takeProfit;
            closeReason = 'Take Profit (TP)';
            isClosed = true;
          } else if (fastEma[i] > slowEma[i] && fastEma[i - 1] <= slowEma[i - 1]) {
            exitPrice = bar.close;
            closeReason = 'EMA Cross Exit';
            isClosed = true;
          }
        }

        if (isClosed) {
          const rawDiff = activeTrade.type === 'buy' ? (exitPrice - activeTrade.openPrice) : (activeTrade.openPrice - exitPrice);
          const spreadCost = (config.spread * (symbol === 'EURUSD' || symbol === 'GBPUSD' ? 0.00001 : 0.01)) * config.lotSize * pointValue;
          const commissionCost = config.commission * config.lotSize * 2;
          
          let pnl = (rawDiff * config.lotSize * pointValue) - spreadCost - commissionCost;
          pnl = Math.round(pnl * 100) / 100;

          capital += pnl;
          capital = Math.round(capital * 100) / 100;

          if (capital > peakCapital) peakCapital = capital;
          const currentDd = peakCapital - capital;
          const currentDdPct = (currentDd / peakCapital) * 100;
          if (currentDd > maxDrawdown) maxDrawdown = currentDd;
          if (currentDdPct > maxDrawdownPct) maxDrawdownPct = currentDdPct;

          const openD = new Date(activeTrade.openTime);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const dateFmt = `${String(openD.getDate()).padStart(2, '0')} ${monthNames[openD.getMonth()]}`;
          const timeFmt = `${String(openD.getHours()).padStart(2, '0')}:${String(openD.getMinutes()).padStart(2, '0')}`;

          const pricePrecision = symbol === 'EURUSD' || symbol === 'GBPUSD' ? 4 : (symbol === 'XAUUSD' || symbol === 'BTCUSD' ? 0 : 2);

          trades.push({
            ticket: `BT-${1000 + trades.length + 1}`,
            dateFormatted: dateFmt,
            timeFormatted: timeFmt,
            openTime: activeTrade.openTime,
            closeTime: bar.time,
            monthStr: bar.monthStr,
            dayOfWeek: bar.dayOfWeek,
            type: activeTrade.type,
            side: activeTrade.type.toUpperCase(),
            lots: config.lotSize,
            symbol: config.symbol,
            openPrice: activeTrade.openPrice.toFixed(pricePrecision),
            closePrice: exitPrice.toFixed(pricePrecision),
            stopLoss: activeTrade.stopLoss.toFixed(pricePrecision),
            takeProfit: activeTrade.takeProfit.toFixed(pricePrecision),
            commission: Math.round(commissionCost * 100) / 100,
            swap: 0,
            profit: pnl,
            profitFormatted: `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(0) === '0' ? Math.abs(pnl).toFixed(2) : Math.abs(pnl).toFixed(0)}`,
            closeReason,
            isWin: pnl > 0,
            isLoss: pnl < 0
          });

          equityCurve.push({
            date: bar.dateStr,
            equity: capital,
            pnl
          });

          drawdownCurve.push({
            date: bar.dateStr,
            drawdownPct: -Math.round(currentDdPct * 100) / 100
          });

          activeTrade = null;
        }
      }

      // Check entry signal if no active trade
      if (!activeTrade) {
        const bullishCross = fastEma[i] > slowEma[i] && fastEma[i - 1] <= slowEma[i - 1];
        const bearishCross = fastEma[i] < slowEma[i] && fastEma[i - 1] >= slowEma[i - 1];

        if (bullishCross && bar.close > trendEma[i]) {
          const entryPrice = bar.close;
          const slDistance = currentAtr * config.stopLossAtr;
          const tpDistance = currentAtr * config.takeProfitAtr;

          activeTrade = {
            type: 'buy',
            openPrice: entryPrice,
            openTime: bar.time,
            stopLoss: entryPrice - slDistance,
            takeProfit: entryPrice + tpDistance
          };
        } else if (bearishCross && bar.close < trendEma[i]) {
          const entryPrice = bar.close;
          const slDistance = currentAtr * config.stopLossAtr;
          const tpDistance = currentAtr * config.takeProfitAtr;

          activeTrade = {
            type: 'sell',
            openPrice: entryPrice,
            openTime: bar.time,
            stopLoss: entryPrice + slDistance,
            takeProfit: entryPrice - tpDistance
          };
        }
      }
    }

    // Summary performance metrics
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit < 0);
    const longTrades = trades.filter(t => t.type === 'buy');
    const shortTrades = trades.filter(t => t.type === 'sell');

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    const netProfit = Math.round((capital - config.initialCapital) * 100) / 100;
    const returnPct = Math.round(((netProfit / config.initialCapital) * 100) * 100) / 100;
    const winRate = totalTrades > 0 ? Math.round((winningTrades.length / totalTrades) * 10000) / 100 : 0;
    const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : (grossProfit > 0 ? 99.99 : 0);
    const avgWin = winningTrades.length > 0 ? Math.round((grossProfit / winningTrades.length) * 100) / 100 : 0;
    const avgLoss = losingTrades.length > 0 ? Math.round((grossLoss / losingTrades.length) * 100) / 100 : 0;
    const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.profit)) : 0;
    const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.profit)) : 0;
    const expectancy = totalTrades > 0 ? Math.round(((grossProfit - grossLoss) / totalTrades) * 100) / 100 : 0;

    // Monthly Performance Breakdown
    const monthlyMap = {};
    trades.forEach(t => {
      const m = t.monthStr || '2025-01';
      if (!monthlyMap[m]) {
        monthlyMap[m] = { month: m, pnl: 0, trades: 0, wins: 0 };
      }
      monthlyMap[m].pnl += t.profit;
      monthlyMap[m].trades += 1;
      if (t.profit > 0) monthlyMap[m].wins += 1;
    });

    const monthlyPerformance = Object.values(monthlyMap).map(item => ({
      month: item.month,
      pnl: Math.round(item.pnl * 100) / 100,
      trades: item.trades,
      winRate: Math.round((item.wins / item.trades) * 100)
    }));

    return {
      config,
      initialCapital: config.initialCapital,
      finalCapital: capital,
      netProfit,
      returnPct,
      totalTrades,
      winnersCount: winningTrades.length,
      losersCount: losingTrades.length,
      longCount: longTrades.length,
      shortCount: shortTrades.length,
      longWinRate: longTrades.length ? Math.round((longTrades.filter(t => t.profit > 0).length / longTrades.length) * 100) : 0,
      shortWinRate: shortTrades.length ? Math.round((shortTrades.filter(t => t.profit > 0).length / shortTrades.length) * 100) : 0,
      winRate,
      profitFactor,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossLoss: Math.round(grossLoss * 100) / 100,
      avgWin,
      avgLoss,
      largestWin: Math.round(largestWin * 100) / 100,
      largestLoss: Math.round(largestLoss * 100) / 100,
      expectancy,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPct: Math.round(maxDrawdownPct * 10) / 10,
      equityCurve,
      drawdownCurve,
      monthlyPerformance,
      trades
    };
  },

  /**
   * Load and display a past backtest from history
   */
  loadBacktest(id, switchTabToOverview = true) {
    const found = this.history.find(h => h.id === id);
    if (!found) return;

    this.currentBacktest = found;
    this.renderHistoryList();
    this.renderAllTabs(found);

    if (switchTabToOverview) {
      this.switchTab('overview');
    }
  },

  /**
   * Render History Sidebar List (#001, #002...)
   */
  renderHistoryList() {
    const listEl = document.getElementById('backtestHistoryList');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (this.history.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 0.82rem;">
          No backtest history yet.<br>Run a strategy to save results!
        </div>
      `;
      return;
    }

    this.history.forEach(item => {
      const div = document.createElement('div');
      const isSelected = this.currentBacktest && this.currentBacktest.id === item.id;
      div.className = `bt-history-item ${isSelected ? 'active' : ''}`;
      
      const returnClass = item.returnPct >= 0 ? 'pos' : 'neg';
      const returnSign = item.returnPct >= 0 ? '+' : '';

      div.innerHTML = `
        <div class="bt-history-left">
          <span class="bt-history-id">${item.id}</span>
          <span class="bt-history-sym">${item.config.symbol} ${item.config.strategyName || 'EMA'}</span>
        </div>
        <div class="bt-history-right">
          <span class="bt-history-return ${returnClass}">${returnSign}${item.returnPct.toFixed(1)}%</span>
          <button class="bt-history-del" title="Delete backtest" onclick="BacktestEngine.deleteBacktest('${item.id}', event)">✕</button>
        </div>
      `;

      div.addEventListener('click', () => this.loadBacktest(item.id));
      listEl.appendChild(div);
    });
  },

  /**
   * Format helper: Currency
   */
  fmtCurr(val, withPlus = false) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    const sign = val > 0 && withPlus ? '+' : (val < 0 ? '-' : '');
    return `${sign}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  /**
   * Format helper: Date span text
   */
  formatDateSpan(startStr, endStr) {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(s.getDate()).padStart(2, '0')} ${m[s.getMonth()]} ${s.getFullYear()} → ${String(e.getDate()).padStart(2, '0')} ${m[e.getMonth()]} ${e.getFullYear()}`;
  },

  /**
   * Render all tabs with backtest data
   */
  renderAllTabs(results) {
    // 1. Meta Headers
    const idEl = document.getElementById('btActiveId');
    if (idEl) idEl.innerText = results.id || 'Backtest #001';

    const stratEl = document.getElementById('btActiveStrategy');
    if (stratEl) stratEl.innerText = results.config.strategyName || 'EMA Strategy';

    const symEl = document.getElementById('btActiveSymbol');
    if (symEl) symEl.innerText = results.config.symbol;

    const tfEl = document.getElementById('btActiveTimeframe');
    if (tfEl) tfEl.innerText = results.config.timeframe;

    const periodEl = document.getElementById('btActivePeriod');
    if (periodEl) periodEl.innerText = this.formatDateSpan(results.config.startDate, results.config.endDate);

    const capEl = document.getElementById('btActiveCapital');
    if (capEl) capEl.innerText = this.fmtCurr(results.initialCapital);

    // 2. Scorecard Values
    const setVal = (id, text, className) => {
      const el = document.getElementById(id);
      if (el) {
        el.innerText = text;
        if (className) el.className = className;
      }
    };

    setVal('btInitialBal', this.fmtCurr(results.initialCapital), 'stat-val');
    setVal('btFinalBal', this.fmtCurr(results.finalCapital), 'stat-val');
    
    setVal('btNetProfit', this.fmtCurr(results.netProfit, true), `stat-val ${results.netProfit >= 0 ? 'profit' : 'loss'}`);
    setVal('btReturn', `${results.returnPct >= 0 ? '+' : ''}${results.returnPct.toFixed(2)}%`, `stat-val ${results.returnPct >= 0 ? 'profit' : 'loss'}`);

    setVal('btTradesCount', String(results.totalTrades), 'stat-val');
    setVal('btWinningTrades', String(results.winnersCount), 'stat-val profit');
    setVal('btLosingTrades', String(results.losersCount), 'stat-val loss');

    setVal('btWinRate', `${results.winRate.toFixed(2)}%`, 'stat-val');
    setVal('btProfitFactor', results.profitFactor.toFixed(2), 'stat-val');

    setVal('btAvgWin', this.fmtCurr(results.avgWin, true), 'stat-val profit');
    setVal('btAvgLoss', this.fmtCurr(results.avgLoss ? -results.avgLoss : 0), 'stat-val loss');

    setVal('btLargestWin', this.fmtCurr(results.largestWin, true), 'stat-val profit');
    setVal('btLargestLoss', this.fmtCurr(results.largestLoss), 'stat-val loss');

    setVal('btMaxDd', `-${results.maxDrawdownPct.toFixed(1)}%`, 'stat-val loss');
    setVal('btExpectancy', this.fmtCurr(results.expectancy, true), `stat-val ${results.expectancy >= 0 ? 'profit' : 'loss'}`);

    // Render Tab Views
    this.renderOverviewEquityChart(results.equityCurve);
    this.renderEquityChart(results.equityCurve);
    this.renderDrawdownChart(results.drawdownCurve);
    this.renderMonthlyChart(results.monthlyPerformance);
    this.renderDistributionChart(results);
    this.renderTradesTable(results.trades);
  },

  /**
   * Render Mini Equity Chart on Overview Tab
   */
  renderOverviewEquityChart(curve) {
    const ctx = document.getElementById('btOverviewEquityCanvas');
    if (!ctx) return;

    if (this.overviewEquityChartInstance) {
      this.overviewEquityChartInstance.destroy();
    }

    const labels = curve.map(c => c.date);
    const values = curve.map(c => c.equity);
    const isProfitable = values[values.length - 1] >= values[0];
    const baseColor = isProfitable ? '#10b981' : '#f43f5e';

    const canvasCtx = ctx.getContext('2d');
    const gradient = canvasCtx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, isProfitable ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

    this.overviewEquityChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: baseColor,
          borderWidth: 2,
          backgroundColor: gradient,
          fill: true,
          tension: 0.2,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: {
            grid: { color: 'rgba(38, 46, 69, 0.4)' },
            ticks: { color: '#64748b', callback: (v) => `$${v.toLocaleString()}` }
          }
        }
      }
    });
  },

  /**
   * Render Large Equity Curve Chart
   */
  renderEquityChart(curve) {
    const ctx = document.getElementById('backtestEquityCanvas');
    if (!ctx) return;

    if (this.equityChartInstance) {
      this.equityChartInstance.destroy();
    }

    const labels = curve.map(c => c.date);
    const values = curve.map(c => c.equity);

    const canvasCtx = ctx.getContext('2d');
    const gradient = canvasCtx.createLinearGradient(0, 0, 0, 280);
    const isProfitable = values[values.length - 1] >= values[0];
    const baseColor = isProfitable ? '#10b981' : '#f43f5e';

    gradient.addColorStop(0, isProfitable ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

    this.equityChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Equity ($)',
          data: values,
          borderColor: baseColor,
          borderWidth: 2.5,
          backgroundColor: gradient,
          fill: true,
          tension: 0.2,
          pointRadius: values.length > 50 ? 0 : 3,
          pointHoverRadius: 6
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
            callbacks: {
              label: (item) => `Balance: $${item.raw.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(38, 46, 69, 0.5)' },
            ticks: { color: '#64748b', maxTicksLimit: 8 }
          },
          y: {
            grid: { color: 'rgba(38, 46, 69, 0.5)' },
            ticks: {
              color: '#64748b',
              callback: (v) => `$${v.toLocaleString()}`
            }
          }
        }
      }
    });
  },

  /**
   * Render Drawdown (%) Chart
   */
  renderDrawdownChart(curve) {
    const ctx = document.getElementById('backtestDrawdownCanvas');
    if (!ctx) return;

    if (this.drawdownChartInstance) {
      this.drawdownChartInstance.destroy();
    }

    const labels = curve.map(c => c.date);
    const values = curve.map(c => c.drawdownPct);

    const canvasCtx = ctx.getContext('2d');
    const gradient = canvasCtx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(244, 63, 94, 0.02)');
    gradient.addColorStop(1, 'rgba(244, 63, 94, 0.35)');

    this.drawdownChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Drawdown (%)',
          data: values,
          borderColor: '#f43f5e',
          borderWidth: 2,
          backgroundColor: gradient,
          fill: true,
          tension: 0.15,
          pointRadius: 0,
          pointHoverRadius: 5
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
            callbacks: {
              label: (item) => `Drawdown: ${item.raw.toFixed(2)}%`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(38, 46, 69, 0.5)' },
            ticks: { color: '#64748b', maxTicksLimit: 8 }
          },
          y: {
            max: 0,
            grid: { color: 'rgba(38, 46, 69, 0.5)' },
            ticks: {
              color: '#64748b',
              callback: (v) => `${v}%`
            }
          }
        }
      }
    });
  },

  /**
   * Render Monthly Performance Bar Chart
   */
  renderMonthlyChart(monthlyData) {
    const ctx = document.getElementById('btMonthlyCanvas');
    if (!ctx || !monthlyData) return;

    if (this.monthlyChartInstance) {
      this.monthlyChartInstance.destroy();
    }

    const labels = monthlyData.map(m => m.month);
    const values = monthlyData.map(m => m.pnl);
    const bgColors = values.map(v => v >= 0 ? '#10b981' : '#f43f5e');

    this.monthlyChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Monthly Net P&L ($)',
          data: values,
          backgroundColor: bgColors,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `Net P&L: $${item.raw.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b' }
          },
          y: {
            grid: { color: 'rgba(38, 46, 69, 0.5)' },
            ticks: { color: '#64748b', callback: (v) => `$${v}` }
          }
        }
      }
    });

    // Render monthly table list
    const listEl = document.getElementById('btMonthlyList');
    if (listEl) {
      listEl.innerHTML = monthlyData.map(m => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border-color); font-size: 0.84rem;">
          <span style="font-weight: 600; color: var(--text-main);">${m.month}</span>
          <span style="color: var(--text-dim);">${m.trades} trades (${m.winRate}% win)</span>
          <span style="font-weight: 700; color: ${m.pnl >= 0 ? 'var(--profit)' : 'var(--loss)'};">${m.pnl >= 0 ? '+' : ''}$${m.pnl.toFixed(2)}</span>
        </div>
      `).join('');
    }
  },

  /**
   * Render Trade Distribution Donuts / Metrics on Analysis Tab
   */
  renderDistributionChart(res) {
    const ctx = document.getElementById('btDistributionCanvas');
    if (!ctx) return;

    if (this.distributionChartInstance) {
      this.distributionChartInstance.destroy();
    }

    this.distributionChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Winning Trades', 'Losing Trades'],
        datasets: [{
          data: [res.winnersCount, res.losersCount],
          backgroundColor: ['#10b981', '#f43f5e'],
          borderColor: '#181d2c',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', boxWidth: 12 }
          }
        },
        cutout: '70%'
      }
    });

    // Additional Analysis Stats
    const statsEl = document.getElementById('btAnalysisDetails');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-item"><span class="stat-label">Long Trades</span><span class="stat-val">${res.longCount} (${res.longWinRate}% win)</span></div>
        <div class="stat-item"><span class="stat-label">Short Trades</span><span class="stat-val">${res.shortCount} (${res.shortWinRate}% win)</span></div>
        <div class="stat-item"><span class="stat-label">Gross Profit</span><span class="stat-val profit">+$${res.grossProfit.toFixed(2)}</span></div>
        <div class="stat-item"><span class="stat-label">Gross Loss</span><span class="stat-val loss">-$${res.grossLoss.toFixed(2)}</span></div>
        <div class="stat-item"><span class="stat-label">Avg Risk:Reward</span><span class="stat-val">1:${(res.avgLoss ? Math.abs(res.avgWin / res.avgLoss) : 0).toFixed(2)}</span></div>
      `;
    }
  },

  /**
   * Render simulated trade logs table matching Date | Time | Symbol | Side | Entry | Exit | SL | TP | P/L
   */
  renderTradesTable(trades, searchQuery = '') {
    const tbody = document.getElementById('backtestTradesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    let filtered = trades;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = trades.filter(t => 
        t.ticket.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.side.toLowerCase().includes(q) ||
        t.dateFormatted.toLowerCase().includes(q)
      );
    }

    const displayTrades = filtered.slice(0, 100);

    displayTrades.forEach((t) => {
      const tr = document.createElement('tr');
      const pnlClass = t.profit > 0 ? 'profit-text' : (t.profit < 0 ? 'loss-text' : 'neutral-text');
      const sideClass = t.type === 'buy' ? 'type-badge buy' : 'type-badge sell';

      tr.innerHTML = `
        <td style="color: var(--text-main); font-weight: 500;">${t.dateFormatted}</td>
        <td style="color: var(--text-dim); font-size: 0.8rem; font-family: var(--font-mono);">${t.timeFormatted}</td>
        <td><span class="symbol-badge">${t.symbol}</span></td>
        <td><span class="${sideClass}">${t.side}</span></td>
        <td style="font-family: var(--font-mono);">${t.openPrice}</td>
        <td style="font-family: var(--font-mono);">${t.closePrice}</td>
        <td style="font-family: var(--font-mono); color: var(--loss);">${t.stopLoss}</td>
        <td style="font-family: var(--font-mono); color: var(--profit);">${t.takeProfit}</td>
        <td class="${pnlClass}" style="font-weight: 700;">${t.profitFormatted}</td>
      `;

      tbody.appendChild(tr);
    });

    const infoEl = document.getElementById('backtestTableInfo');
    if (infoEl) {
      infoEl.innerText = `Showing ${Math.min(100, filtered.length)} of ${filtered.length} trades`;
    }
  },

  /**
   * Import Backtest trades directly into TradeForge Journal
   */
  importToJournal() {
    if (!this.currentBacktest || !this.currentBacktest.trades.length) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('Please run or select a backtest first.', 'error');
      }
      return;
    }

    const trades = this.currentBacktest.trades;
    StorageManager.saveTrades(trades, `${this.currentBacktest.id}_${this.currentBacktest.config.symbol}`);
    
    if (window.App) {
      window.App.trades = trades;
      window.App.processTrades();
      window.App.switchView('dashboard');
      window.App.showToast(`Imported ${trades.length} backtest trades to Dashboard & Calendar!`, 'success');
    }
  },

  /**
   * Export backtest trades to a CSV file
   */
  exportCSV() {
    if (!this.currentBacktest || !this.currentBacktest.trades.length) return;

    const trades = this.currentBacktest.trades;
    const header = 'Date,Time,Symbol,Side,Entry,Exit,SL,TP,PnL,CloseReason\n';
    const rows = trades.map(t => 
      `${t.dateFormatted},${t.timeFormatted},${t.symbol},${t.side},${t.openPrice},${t.closePrice},${t.stopLoss},${t.takeProfit},${t.profit},${t.closeReason}`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `backtest_${this.currentBacktest.id.replace('#', '')}_${this.currentBacktest.config.symbol}_${Date.now()}.csv`;
    link.click();
  },

  /**
   * Helper: Calculate Exponential Moving Average
   */
  calcEMA(data, period) {
    const k = 2 / (period + 1);
    const emaArray = new Array(data.length);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emaArray[period - 1] = ema;

    for (let i = period; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
      emaArray[i] = ema;
    }
    return emaArray;
  },

  /**
   * Helper: Calculate Average True Range
   */
  calcATR(bars, period = 14) {
    const trs = [bars[0].high - bars[0].low];
    for (let i = 1; i < bars.length; i++) {
      const h = bars[i].high;
      const l = bars[i].low;
      const prevClose = bars[i - 1].close;
      const tr = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
      trs.push(tr);
    }

    const atrs = new Array(bars.length);
    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    atrs[period - 1] = atr;

    for (let i = period; i < bars.length; i++) {
      atr = (atr * (period - 1) + trs[i]) / period;
      atrs[i] = atr;
    }
    return atrs;
  }
};
