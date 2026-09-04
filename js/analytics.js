/**
 * TradeForge - Analytics & Trading Performance Calculations
 */

const TradeAnalytics = {
  /**
   * Compute complete performance metrics from trades array
   */
  calculateMetrics(trades) {
    if (!trades || trades.length === 0) {
      return this.getEmptyMetrics();
    }

    let totalPnL = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let winnersCount = 0;
    let losersCount = 0;
    let breakEvenCount = 0;
    let totalLots = 0;
    let maxWin = 0;
    let maxLoss = 0;

    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;

    // Daily breakdown mapping: 'YYYY-MM-DD' => { date, pnl, tradesCount, wins, losses }
    const dailyMap = {};
    // Symbol breakdown mapping: 'SYMBOL' => { symbol, pnl, trades, wins, losses, volume }
    const symbolMap = {};
    // Day of week breakdown: 0=Sun..6=Sat
    const weekdayMap = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const weekdayCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const weekdayWins = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const weekdayLosses = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    // Buy vs Sell
    const typeBreakdown = {
      buy: { count: 0, pnl: 0, wins: 0, losses: 0 },
      sell: { count: 0, pnl: 0, wins: 0, losses: 0 }
    };

    trades.forEach((trade) => {
      const pnl = trade.profit || 0;
      totalPnL += pnl;
      totalLots += (trade.lots || 0);

      // Best / Worst trade
      if (pnl > maxWin) maxWin = pnl;
      if (pnl < maxLoss) maxLoss = pnl;

      // Win / Loss / BE
      if (pnl > 0) {
        winnersCount++;
        grossProfit += pnl;
        currentWinStreak++;
        currentLossStreak = 0;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      } else if (pnl < 0) {
        losersCount++;
        grossLoss += Math.abs(pnl);
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
      } else {
        breakEvenCount++;
      }

      // Date parsing
      const tradeDateStr = (trade.closeTime || trade.openTime || '').slice(0, 10);
      if (tradeDateStr) {
        if (!dailyMap[tradeDateStr]) {
          dailyMap[tradeDateStr] = {
            date: tradeDateStr,
            pnl: 0,
            trades: 0,
            wins: 0,
            losses: 0,
            tradeList: []
          };
        }
        dailyMap[tradeDateStr].pnl += pnl;
        dailyMap[tradeDateStr].trades += 1;
        dailyMap[tradeDateStr].tradeList.push(trade);
        if (pnl > 0) dailyMap[tradeDateStr].wins++;
        if (pnl < 0) dailyMap[tradeDateStr].losses++;

        // Weekday
        const d = new Date(tradeDateStr);
        const dayOfWeek = d.getUTCDay();
        weekdayMap[dayOfWeek] += pnl;
        weekdayCount[dayOfWeek] += 1;
        if (pnl > 0) weekdayWins[dayOfWeek] += 1;
        if (pnl < 0) weekdayLosses[dayOfWeek] += 1;
      }

      // Symbol breakdown
      const sym = trade.symbol || 'OTHER';
      if (!symbolMap[sym]) {
        symbolMap[sym] = { symbol: sym, pnl: 0, trades: 0, wins: 0, losses: 0, volume: 0 };
      }
      symbolMap[sym].pnl += pnl;
      symbolMap[sym].trades += 1;
      symbolMap[sym].volume += (trade.lots || 0);
      if (pnl > 0) symbolMap[sym].wins++;
      if (pnl < 0) symbolMap[sym].losses++;

      // Type
      const t = trade.type === 'sell' ? 'sell' : 'buy';
      typeBreakdown[t].count++;
      typeBreakdown[t].pnl += pnl;
      if (pnl > 0) typeBreakdown[t].wins++;
      if (pnl < 0) typeBreakdown[t].losses++;
    });

    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? (winnersCount / totalTrades) * 100 : 0;
    const lossRate = totalTrades > 0 ? (losersCount / totalTrades) * 100 : 0;

    const avgWin = winnersCount > 0 ? grossProfit / winnersCount : 0;
    const avgLoss = losersCount > 0 ? grossLoss / losersCount : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.99 : 0);

    // Days calculations
    const sortedDays = Object.keys(dailyMap).sort();
    let winningDaysCount = 0;
    let losingDaysCount = 0;
    let breakEvenDaysCount = 0;
    let runningCumPnL = 0;
    const cumulativeTimeseries = [];
    const dailyTimeseries = [];

    sortedDays.forEach((dayStr) => {
      const dayData = dailyMap[dayStr];
      dayData.pnl = Math.round(dayData.pnl * 100) / 100;
      runningCumPnL += dayData.pnl;
      runningCumPnL = Math.round(runningCumPnL * 100) / 100;

      if (dayData.pnl > 0) winningDaysCount++;
      else if (dayData.pnl < 0) losingDaysCount++;
      else breakEvenDaysCount++;

      cumulativeTimeseries.push({
        date: dayStr,
        cumulativePnL: runningCumPnL,
        dailyPnL: dayData.pnl,
        trades: dayData.trades
      });

      dailyTimeseries.push({
        date: dayStr,
        dailyPnL: dayData.pnl,
        trades: dayData.trades
      });
    });

    // Weekly breakdown aggregation
    const weeklyMap = {};
    const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    sortedDays.forEach((dayStr) => {
      const dayData = dailyMap[dayStr];
      const dParts = dayStr.split('-').map(Number);
      const d = new Date(Date.UTC(dParts[0], dParts[1] - 1, dParts[2]));
      
      // Calculate Monday of this week
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
      const weekStartStr = monday.toISOString().slice(0, 10);

      if (!weeklyMap[weekStartStr]) {
        const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
        const weekEndStr = sunday.toISOString().slice(0, 10);
        const label = `${mNames[monday.getUTCMonth()]} ${String(monday.getUTCDate()).padStart(2, '0')} - ${mNames[sunday.getUTCMonth()]} ${String(sunday.getUTCDate()).padStart(2, '0')}`;
        const shortLabel = `${mNames[monday.getUTCMonth()]} ${monday.getUTCDate()}`;

        weeklyMap[weekStartStr] = {
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          label,
          shortLabel,
          weeklyPnL: 0,
          trades: 0,
          wins: 0,
          losses: 0
        };
      }

      weeklyMap[weekStartStr].weeklyPnL += dayData.pnl;
      weeklyMap[weekStartStr].trades += dayData.trades;
      weeklyMap[weekStartStr].wins += dayData.wins;
      weeklyMap[weekStartStr].losses += dayData.losses;
    });

    const sortedWeeks = Object.keys(weeklyMap).sort();
    let runningWeeklyCum = 0;
    const weeklyTimeseries = sortedWeeks.map((wKey) => {
      const w = weeklyMap[wKey];
      w.weeklyPnL = Math.round(w.weeklyPnL * 100) / 100;
      runningWeeklyCum += w.weeklyPnL;
      runningWeeklyCum = Math.round(runningWeeklyCum * 100) / 100;
      return {
        weekStart: w.weekStart,
        weekEnd: w.weekEnd,
        label: w.label,
        shortLabel: w.shortLabel,
        weeklyPnL: w.weeklyPnL,
        cumulativePnL: runningWeeklyCum,
        trades: w.trades,
        wins: w.wins,
        losses: w.losses
      };
    });

    const totalTradingDays = sortedDays.length;
    const dayWinRate = totalTradingDays > 0 ? (winningDaysCount / totalTradingDays) * 100 : 0;

    // Date range
    const firstTradeDate = sortedDays.length > 0 ? sortedDays[0] : null;
    const lastTradeDate = sortedDays.length > 0 ? sortedDays[sortedDays.length - 1] : null;

    // Day of week analysis: identify profitable day and lossing day
    const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const activeDays = Object.keys(weekdayCount)
      .map(Number)
      .filter(idx => weekdayCount[idx] > 0);

    let profitableDay = null;
    let lossingDay = null;

    if (activeDays.length > 0) {
      // Sort weekdays by Net P&L (highest to lowest)
      const sortedByPnl = [...activeDays].sort((a, b) => weekdayMap[b] - weekdayMap[a]);
      const bestIdx = sortedByPnl[0];
      const bestTrades = weekdayCount[bestIdx];
      const bestWins = weekdayWins[bestIdx];
      const bestWinRate = bestTrades > 0 ? Math.round((bestWins / bestTrades) * 100) : 0;
      profitableDay = {
        dayIndex: bestIdx,
        dayName: dayNamesFull[bestIdx],
        pnl: Math.round(weekdayMap[bestIdx] * 100) / 100,
        trades: bestTrades,
        wins: bestWins,
        losses: weekdayLosses[bestIdx],
        winRate: bestWinRate
      };

      const worstIdx = sortedByPnl[sortedByPnl.length - 1];
      const worstTrades = weekdayCount[worstIdx];
      const worstWins = weekdayWins[worstIdx];
      const worstWinRate = worstTrades > 0 ? Math.round((worstWins / worstTrades) * 100) : 0;
      lossingDay = {
        dayIndex: worstIdx,
        dayName: dayNamesFull[worstIdx],
        pnl: Math.round(weekdayMap[worstIdx] * 100) / 100,
        trades: worstTrades,
        wins: worstWins,
        losses: weekdayLosses[worstIdx],
        winRate: worstWinRate
      };
    }

    return {
      totalPnL: Math.round(totalPnL * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossLoss: Math.round(grossLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      totalTrades,
      winnersCount,
      losersCount,
      breakEvenCount,
      winRate: Math.round(winRate * 10) / 10,
      lossRate: Math.round(lossRate * 10) / 10,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      maxWin: Math.round(maxWin * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      maxWinStreak,
      maxLossStreak,
      totalLots: Math.round(totalLots * 100) / 100,
      
      // Days Metrics
      totalTradingDays,
      winningDaysCount,
      losingDaysCount,
      breakEvenDaysCount,
      dayWinRate: Math.round(dayWinRate * 10) / 10,

      // Timelines
      firstTradeDate,
      lastTradeDate,
      dailyMap,
      cumulativeTimeseries,
      dailyTimeseries,
      weeklyTimeseries,

      // Groupings
      // Groupings & Day Performance
      symbolBreakdown: Object.values(symbolMap).sort((a, b) => b.pnl - a.pnl),
      typeBreakdown,
      weekdayMap,
      weekdayCount
      weekdayCount,
      weekdayWins,
      weekdayLosses,
      profitableDay,
      lossingDay
    };
  },

  /**
   * Format currency values nicely (e.g. +$256.36 or -$112.36)
   */
  formatCurrency(value, withSign = true) {
    const num = Number(value) || 0;
    const sign = num > 0 ? (withSign ? '+' : '') : (num < 0 ? '-' : '');
    const formatted = Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${sign}$${formatted}`;
  },

  /**
   * Returns empty metrics template
   */
  getEmptyMetrics() {
    return {
      totalPnL: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      totalTrades: 0,
      winnersCount: 0,
      losersCount: 0,
      breakEvenCount: 0,
      winRate: 0,
      lossRate: 0,
      avgWin: 0,
      avgLoss: 0,
      maxWin: 0,
      maxLoss: 0,
      maxWinStreak: 0,
      maxLossStreak: 0,
      totalLots: 0,
      totalTradingDays: 0,
      winningDaysCount: 0,
      losingDaysCount: 0,
      breakEvenDaysCount: 0,
      dayWinRate: 0,
      firstTradeDate: null,
      lastTradeDate: null,
      dailyMap: {},
      cumulativeTimeseries: [],
      dailyTimeseries: [],
      weeklyTimeseries: [],
      symbolBreakdown: [],
      typeBreakdown: { buy: { count: 0, pnl: 0 }, sell: { count: 0, pnl: 0 } },
      weekdayMap: {},
      weekdayCount: {}
      weekdayCount: {},
      weekdayWins: {},
      weekdayLosses: {},
      profitableDay: null,
      lossingDay: null
    };
  }
};

