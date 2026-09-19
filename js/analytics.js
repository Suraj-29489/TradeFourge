/**
 * TradeForge - Analytics & Trading Performance Calculations
 */

const TradeAnalytics = {
  /**
   * Compute complete performance metrics from trades array
   */
  calculateMetrics(trades, customStartingCapital = null) {
    if (!trades || trades.length === 0) {
      return this.getEmptyMetrics(customStartingCapital);
    }

    const startingCapital = customStartingCapital !== null && customStartingCapital !== undefined && !isNaN(Number(customStartingCapital)) && Number(customStartingCapital) > 0
      ? Number(customStartingCapital)
      : this.getStartingCapital();

    let totalPnL = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let winnersCount = 0;
    let losersCount = 0;
    let breakEvenCount = 0;
    let totalLots = 0;
    let maxWin = 0;
    let maxLoss = 0;
    let maxWinTrade = null;
    let maxLossTrade = null;

    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;

    // Daily breakdown mapping: 'YYYY-MM-DD' => { date, pnl, tradesCount, wins, losses }
    const dailyMap = {};
    // Monthly breakdown mapping: 'YYYY-MM' => { monthKey, year, month, label, fullLabel, monthlyPnL, trades, wins, losses, breakEven }
    const monthlyMap = {};
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

    const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    trades.forEach((trade) => {
      const pnl = Number(trade.profit) || 0;
      totalPnL += pnl;
      totalLots += (Number(trade.lots) || 0);

      // Best / Worst trade
      if (pnl > maxWin) {
        maxWin = pnl;
        maxWinTrade = trade;
      }
      if (pnl < maxLoss) {
        maxLoss = pnl;
        maxLossTrade = trade;
      }

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

      // Date parsing (uses closing date when trade closed, fallback to open date)
      const tradeDateStr = (trade.closeTime || trade.openTime || '').slice(0, 10);
      if (tradeDateStr && tradeDateStr.length === 10) {
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

        // Monthly breakdown mapping
        const monthKey = tradeDateStr.slice(0, 7); // 'YYYY-MM'
        const parts = monthKey.split('-').map(Number);
        const yr = parts[0];
        const mIdx = parts[1] - 1;

        if (!monthlyMap[monthKey]) {
          const label = `${mNames[mIdx]} ${yr}`;
          const fullLabel = `${fullMonthNames[mIdx]} ${yr}`;
          monthlyMap[monthKey] = {
            monthKey,
            year: yr,
            month: mIdx + 1,
            label,
            fullLabel,
            monthlyPnL: 0,
            trades: 0,
            wins: 0,
            losses: 0,
            breakEven: 0
          };
        }
        monthlyMap[monthKey].monthlyPnL += pnl;
        monthlyMap[monthKey].trades += 1;
        if (pnl > 0) monthlyMap[monthKey].wins++;
        else if (pnl < 0) monthlyMap[monthKey].losses++;
        else monthlyMap[monthKey].breakEven++;

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
      symbolMap[sym].volume += (Number(trade.lots) || 0);
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

    // Expectancy per trade: total realized P&L / total closed trades
    const expectancy = totalTrades > 0 ? totalPnL / totalTrades : 0;

    // Net Return % & Calculated Balance based on starting capital
    let netReturnPercent = null;
    let calculatedBalance = null;
    if (startingCapital && startingCapital > 0) {
      netReturnPercent = Math.round(((totalPnL / startingCapital) * 100) * 100) / 100;
      calculatedBalance = Math.round((startingCapital + totalPnL) * 100) / 100;
    }

    // Chronological realized equity curve for Maximum Drawdown calculation
    // Sort trades chronologically by closing time (fallback to open time)
    const chronologicalTrades = [...trades].sort((a, b) => {
      const timeA = a.closeTime || a.openTime || '';
      const timeB = b.closeTime || b.openTime || '';
      return timeA.localeCompare(timeB);
    });

    let peakEquityPnL = 0;
    let runningEquityPnL = 0;
    let maxDrawdownAmount = 0;

    chronologicalTrades.forEach((t) => {
      const pnl = Number(t.profit) || 0;
      runningEquityPnL += pnl;
      if (runningEquityPnL > peakEquityPnL) {
        peakEquityPnL = runningEquityPnL;
      }
      const dd = peakEquityPnL - runningEquityPnL;
      if (dd > maxDrawdownAmount) {
        maxDrawdownAmount = dd;
      }
    });

    maxDrawdownAmount = Math.round(maxDrawdownAmount * 100) / 100;
    let maxDrawdownPercent = null;
    if (startingCapital && startingCapital > 0) {
      maxDrawdownPercent = Math.round(((maxDrawdownAmount / startingCapital) * 100) * 100) / 100;
    }

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

    // Monthly breakdown timeseries
    const sortedMonths = Object.keys(monthlyMap).sort();
    let runningMonthlyCum = 0;
    const monthlyTimeseries = sortedMonths.map((mKey) => {
      const m = monthlyMap[mKey];
      m.monthlyPnL = Math.round(m.monthlyPnL * 100) / 100;
      runningMonthlyCum += m.monthlyPnL;
      runningMonthlyCum = Math.round(runningMonthlyCum * 100) / 100;
      const mWinRate = m.trades > 0 ? Math.round((m.wins / m.trades) * 1000) / 10 : 0;
      return {
        monthKey: m.monthKey,
        year: m.year,
        month: m.month,
        label: m.label,
        fullLabel: m.fullLabel,
        monthlyPnL: m.monthlyPnL,
        cumulativePnL: runningMonthlyCum,
        trades: m.trades,
        wins: m.wins,
        losses: m.losses,
        breakEven: m.breakEven,
        winRate: mWinRate
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

    // Profit Source (Symbol Breakdown & Contribution)
    const symbolsList = Object.values(symbolMap);
    const positiveSymbols = symbolsList.filter(s => s.pnl > 0).sort((a, b) => b.pnl - a.pnl);
    const negativeSymbols = symbolsList.filter(s => s.pnl < 0).sort((a, b) => a.pnl - b.pnl);
    const zeroSymbols = symbolsList.filter(s => s.pnl === 0);

    const roundedTotalPnL = Math.round(totalPnL * 100) / 100;
    const isTotalPnLPositive = roundedTotalPnL > 0;

    const mapSymbolItem = (s) => {
      const pnl = Math.round(s.pnl * 100) / 100;
      const contributionPercent = isTotalPnLPositive && pnl > 0
        ? Math.round((pnl / roundedTotalPnL) * 1000) / 10
        : (pnl === 0 ? 0 : null);
      const winRate = s.trades > 0 ? Math.round((s.wins / s.trades) * 1000) / 10 : 0;
      return {
        symbol: s.symbol,
        pnl,
        trades: s.trades,
        wins: s.wins,
        losses: s.losses,
        volume: Math.round(s.volume * 100) / 100,
        winRate,
        contributionPercent
      };
    };

    const symbolProfitSource = {
      totalPnL: roundedTotalPnL,
      isTotalPositive: isTotalPnLPositive,
      positive: positiveSymbols.map(mapSymbolItem),
      negative: negativeSymbols.map(mapSymbolItem),
      zero: zeroSymbols.map(mapSymbolItem),
      all: symbolsList.sort((a, b) => b.pnl - a.pnl).map(mapSymbolItem)
    };

    // Exit Breakdown (Close Reason Distribution & Metrics)
    const exitMap = {};
    trades.forEach(trade => {
      const rawReason = (trade.closeReason !== undefined && trade.closeReason !== null)
        ? String(trade.closeReason).trim()
        : '';

      const key = rawReason.toLowerCase().replace(/^[\[\(\{<"']+|[\]\)\}>"']+$/g, '').trim();
      let normalizedLabel = 'UNKNOWN';
      if (key === 'tp' || key === 'take_profit' || key === 'takeprofit') {
        normalizedLabel = 'TP';
      } else if (key === 'sl' || key === 'stop_loss' || key === 'stoploss') {
        normalizedLabel = 'SL';
      } else if (key === 'user' || key === 'manual' || key === 'client') {
        normalizedLabel = 'USER';
      } else if (key === 'so' || key === 'stop_out' || key === 'stopout') {
        normalizedLabel = 'STOP OUT';
      } else if (key === '' || key === 'unknown' || key === 'null' || key === 'undefined') {
        normalizedLabel = 'UNKNOWN';
      } else {
        normalizedLabel = key.toUpperCase();
      }

      if (!exitMap[normalizedLabel]) {
        exitMap[normalizedLabel] = {
          reason: normalizedLabel,
          count: 0,
          pnl: 0,
          wins: 0,
          losses: 0,
          breakEven: 0
        };
      }
      const em = exitMap[normalizedLabel];
      em.count += 1;
      const pnl = Number(trade.profit) || 0;
      em.pnl += pnl;
      if (pnl > 0) em.wins += 1;
      else if (pnl < 0) em.losses += 1;
      else em.breakEven += 1;
    });

    const standardExitOrder = ['TP', 'SL', 'USER', 'STOP OUT', 'UNKNOWN'];
    const exitBreakdown = Object.values(exitMap)
      .map(em => {
        const pnl = Math.round(em.pnl * 100) / 100;
        const percentage = totalTrades > 0 ? Math.round((em.count / totalTrades) * 1000) / 10 : 0;
        const winRate = em.count > 0 ? Math.round((em.wins / em.count) * 1000) / 10 : 0;
        const percentageOfPnL = isTotalPnLPositive && pnl > 0
          ? Math.round((pnl / roundedTotalPnL) * 1000) / 10
          : null;
        return {
          reason: em.reason,
          count: em.count,
          percentage,
          pnl,
          wins: em.wins,
          losses: em.losses,
          breakEven: em.breakEven,
          winRate,
          percentageOfPnL
        };
      })
      .sort((a, b) => {
        const idxA = standardExitOrder.indexOf(a.reason);
        const idxB = standardExitOrder.indexOf(b.reason);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return b.count - a.count;
      });

    return {
      totalPnL: roundedTotalPnL,
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
      expectancy: Math.round(expectancy * 100) / 100,
      startingCapital,
      netReturnPercent,
      calculatedBalance,
      maxDrawdownAmount,
      maxDrawdownPercent,
      maxWin: Math.round(maxWin * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      maxWinTrade,
      maxLossTrade,
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
      weeklyMap,
      monthlyMap,
      cumulativeTimeseries,
      dailyTimeseries,
      weeklyTimeseries,
      monthlyTimeseries,

      // Groupings & Day Performance
      symbolBreakdown: Object.values(symbolMap).sort((a, b) => b.pnl - a.pnl),
      symbolProfitSource,
      exitBreakdown,
      typeBreakdown,
      weekdayMap,
      weekdayCount,
      weekdayWins,
      weekdayLosses,
      profitableDay,
      lossingDay,
      durationMetrics: this.calculateDurationMetrics(trades),
      lotMetrics: this.calculateLotMetrics(trades)
    };
  },

  /**
   * Compute Trade Duration Analysis metrics
   */
  calculateDurationMetrics(trades) {
    if (!trades || trades.length === 0) {
      return this.getEmptyDurationMetrics();
    }

    const validTrades = [];
    trades.forEach(t => {
      if (!t.openTime || !t.closeTime) return;
      const o = new Date(t.openTime).getTime();
      const c = new Date(t.closeTime).getTime();
      if (Number.isFinite(o) && Number.isFinite(c) && c >= o) {
        const durationMs = c - o;
        validTrades.push({
          ticket: t.ticket,
          durationMs,
          profit: Number(t.profit) || 0,
          isWin: (t.profit || 0) > 0,
          isLoss: (t.profit || 0) < 0
        });
      }
    });

    if (validTrades.length === 0) {
      return this.getEmptyDurationMetrics();
    }

    // Sort ascending by duration
    validTrades.sort((a, b) => a.durationMs - b.durationMs);

    const totalCount = validTrades.length;
    const totalDurationMs = validTrades.reduce((sum, item) => sum + item.durationMs, 0);
    const avgDurationMs = Math.round(totalDurationMs / totalCount);

    // Median
    const mid = Math.floor(totalCount / 2);
    const medianDurationMs = totalCount % 2 !== 0
      ? validTrades[mid].durationMs
      : Math.round((validTrades[mid - 1].durationMs + validTrades[mid].durationMs) / 2);

    const shortestMs = validTrades[0].durationMs;
    const longestMs = validTrades[totalCount - 1].durationMs;

    // Winners vs Losers Duration
    const winTrades = validTrades.filter(t => t.isWin);
    const lossTrades = validTrades.filter(t => t.isLoss);

    const avgWinDurationMs = winTrades.length > 0
      ? Math.round(winTrades.reduce((sum, t) => sum + t.durationMs, 0) / winTrades.length)
      : 0;

    const avgLossDurationMs = lossTrades.length > 0
      ? Math.round(lossTrades.reduce((sum, t) => sum + t.durationMs, 0) / lossTrades.length)
      : 0;

    // Holding ratio comparison
    let holdRatioText = 'Equal hold times';
    let holdComparisonClass = 'neutral';
    if (avgWinDurationMs > 0 && avgLossDurationMs > 0) {
      if (avgWinDurationMs >= avgLossDurationMs) {
        const ratio = (avgWinDurationMs / avgLossDurationMs).toFixed(1);
        holdRatioText = `Holding winners ${ratio}x longer than losers`;
        holdComparisonClass = 'profit';
      } else {
        const ratio = (avgLossDurationMs / avgWinDurationMs).toFixed(1);
        holdRatioText = `Holding losers ${ratio}x longer than winners`;
        holdComparisonClass = 'loss';
      }
    }

    // Adaptive duration ranges
    const buckets = [
      { key: '0_5m', label: '0–5m', minSec: 0, maxSec: 300, trades: 0, wins: 0, losses: 0, pnl: 0 },
      { key: '5_15m', label: '5–15m', minSec: 300, maxSec: 900, trades: 0, wins: 0, losses: 0, pnl: 0 },
      { key: '15_30m', label: '15–30m', minSec: 900, maxSec: 1800, trades: 0, wins: 0, losses: 0, pnl: 0 },
      { key: '30_60m', label: '30–60m', minSec: 1800, maxSec: 3600, trades: 0, wins: 0, losses: 0, pnl: 0 },
      { key: '1_2h', label: '1–2h', minSec: 3600, maxSec: 7200, trades: 0, wins: 0, losses: 0, pnl: 0 },
      { key: '2_4h', label: '2–4h', minSec: 7200, maxSec: 14400, trades: 0, wins: 0, losses: 0, pnl: 0 },
      { key: '4h_plus', label: '4h+', minSec: 14400, maxSec: Infinity, trades: 0, wins: 0, losses: 0, pnl: 0 }
    ];

    validTrades.forEach(item => {
      const sec = Math.round(item.durationMs / 1000);
      const bucket = buckets.find(b => sec >= b.minSec && sec < b.maxSec);
      if (bucket) {
        bucket.trades++;
        bucket.pnl += item.profit;
        if (item.isWin) bucket.wins++;
        if (item.isLoss) bucket.losses++;
      }
    });

    const distribution = buckets.map(b => ({
      ...b,
      pnl: Math.round(b.pnl * 100) / 100,
      winRate: b.trades > 0 ? Math.round((b.wins / b.trades) * 100) : 0
    }));

    return {
      hasData: true,
      validTradeCount: totalCount,
      avgDurationMs,
      medianDurationMs,
      shortestMs,
      longestMs,
      avgWinDurationMs,
      avgLossDurationMs,
      winCount: winTrades.length,
      lossCount: lossTrades.length,
      holdRatioText,
      holdComparisonClass,
      distribution
    };
  },

  getEmptyDurationMetrics() {
    return {
      hasData: false,
      validTradeCount: 0,
      avgDurationMs: 0,
      medianDurationMs: 0,
      shortestMs: 0,
      longestMs: 0,
      avgWinDurationMs: 0,
      avgLossDurationMs: 0,
      winCount: 0,
      lossCount: 0,
      holdRatioText: 'Not enough data to calculate trade duration.',
      holdComparisonClass: 'neutral',
      distribution: []
    };
  },

  /**
   * Intelligently format duration in milliseconds to human-readable string
   * e.g. 45s, 12m, 4h 18m, 1d 5h
   */
  formatDuration(ms) {
    if (ms === null || ms === undefined || isNaN(ms) || ms < 0) return '--';
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;

    const totalMin = Math.floor(totalSec / 60);
    const remSec = totalSec % 60;
    if (totalMin < 60) {
      return totalMin < 5 && remSec > 0 ? `${totalMin}m ${remSec}s` : `${totalMin}m`;
    }

    const hours = Math.floor(totalMin / 60);
    const remMin = totalMin % 60;
    if (hours < 24) {
      return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  },

  /**
   * Compute Trade Size / Lot Analysis metrics
   */
  calculateLotMetrics(trades) {
    if (!trades || trades.length === 0) {
      return this.getEmptyLotMetrics();
    }

    const validTrades = trades.filter(t => Number.isFinite(t.lots) && t.lots > 0);
    if (validTrades.length === 0) {
      return this.getEmptyLotMetrics();
    }

    const sortedLots = validTrades.map(t => t.lots).sort((a, b) => a - b);
    const totalTradesCount = validTrades.length;
    const totalVolume = validTrades.reduce((sum, t) => sum + t.lots, 0);
    const avgLot = Math.round((totalVolume / totalTradesCount) * 1000) / 1000;

    const mid = Math.floor(totalTradesCount / 2);
    const medianLot = totalTradesCount % 2 !== 0
      ? sortedLots[mid]
      : Math.round(((sortedLots[mid - 1] + sortedLots[mid]) / 2) * 1000) / 1000;

    const smallestLot = sortedLots[0];
    const largestLot = sortedLots[totalTradesCount - 1];

    // Group performance by lot size
    const groupMap = {};
    validTrades.forEach(t => {
      const key = String(Math.round(t.lots * 10000) / 10000);
      if (!groupMap[key]) {
        groupMap[key] = {
          lot: t.lots,
          lotLabel: key,
          trades: 0,
          wins: 0,
          losses: 0,
          breakEven: 0,
          netPnL: 0,
          grossProfit: 0,
          grossLoss: 0,
          totalVolume: 0
        };
      }
      const g = groupMap[key];
      g.trades++;
      const pnl = Number(t.profit) || 0;
      g.netPnL += pnl;
      g.totalVolume += t.lots;
      if (pnl > 0) {
        g.wins++;
        g.grossProfit += pnl;
      } else if (pnl < 0) {
        g.losses++;
        g.grossLoss += Math.abs(pnl);
      } else {
        g.breakEven++;
      }
    });

    const lotBreakdown = Object.values(groupMap)
      .sort((a, b) => a.lot - b.lot)
      .map(g => {
        const winRate = g.trades > 0 ? Math.round((g.wins / g.trades) * 100) : 0;
        const avgPnL = g.trades > 0 ? Math.round((g.netPnL / g.trades) * 100) / 100 : 0;
        return {
          ...g,
          netPnL: Math.round(g.netPnL * 100) / 100,
          grossProfit: Math.round(g.grossProfit * 100) / 100,
          grossLoss: Math.round(g.grossLoss * 100) / 100,
          totalVolume: Math.round(g.totalVolume * 1000) / 1000,
          winRate,
          avgPnL
        };
      });

    return {
      hasData: true,
      totalTradesCount,
      totalVolume: Math.round(totalVolume * 100) / 100,
      avgLot,
      medianLot,
      smallestLot,
      largestLot,
      lotBreakdown
    };
  },

  getEmptyLotMetrics() {
    return {
      hasData: false,
      totalTradesCount: 0,
      totalVolume: 0,
      avgLot: 0,
      medianLot: 0,
      smallestLot: 0,
      largestLot: 0,
      lotBreakdown: []
    };
  },

  /**
   * Format currency values nicely (e.g. +$256.36 or -$112.36)
   * Currency State & Management ($ / ₹)
   */
  currentCurrency: (typeof localStorage !== 'undefined' && localStorage.getItem('tradeforge_currency')) || 'USD',

  getCurrencySymbol() {
    return this.currentCurrency === 'INR' ? '₹' : '$';
  },

  setCurrency(curr) {
    this.currentCurrency = curr === 'INR' ? 'INR' : 'USD';
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('tradeforge_currency', this.currentCurrency);
      } catch (e) {
        console.warn('Unable to persist currency in localStorage:', e);
      }
    }
    return this.getCurrencySymbol();
  },

  /**
   * Format currency values nicely (e.g. +$256.36 or +₹256.36, -$112.36 or -₹112.36)
   */
  formatCurrency(value, withSign = true) {
    const num = Number(value) || 0;
    const sign = num > 0 ? (withSign ? '+' : '') : (num < 0 ? '-' : '');
    const sym = this.getCurrencySymbol();
    const formatted = Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${sign}${sym}${formatted}`;
  },

  /**
   * Starting Capital State & Management
   */
  getStartingCapital() {
    if (typeof localStorage !== 'undefined') {
      try {
        const val = localStorage.getItem('tradeforge_starting_capital');
        if (val !== null && val !== '' && !isNaN(Number(val)) && Number(val) > 0) {
          return Number(val);
        }
      } catch (e) {
        console.warn('Unable to read starting capital from localStorage:', e);
      }
    }
    return null;
  },

  setStartingCapital(val) {
    if (val === null || val === undefined || val === '' || isNaN(Number(val)) || Number(val) <= 0) {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem('tradeforge_starting_capital');
        } catch (e) {
          console.warn('Unable to clear starting capital:', e);
        }
      }
      return null;
    }
    const num = Math.round(Number(val) * 100) / 100;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('tradeforge_starting_capital', String(num));
      } catch (e) {
        console.warn('Unable to persist starting capital in localStorage:', e);
      }
    }
    return num;
  },

  /**
   * Returns empty metrics template
   */
  getEmptyMetrics(customStartingCapital = null) {
    const sc = customStartingCapital !== null && customStartingCapital !== undefined && !isNaN(Number(customStartingCapital)) && Number(customStartingCapital) > 0
      ? Number(customStartingCapital)
      : this.getStartingCapital();

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
      expectancy: 0,
      startingCapital: sc,
      netReturnPercent: null,
      calculatedBalance: sc,
      maxDrawdownAmount: 0,
      maxDrawdownPercent: null,
      maxWin: 0,
      maxLoss: 0,
      maxWinTrade: null,
      maxLossTrade: null,
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
      weeklyMap: {},
      monthlyMap: {},
      cumulativeTimeseries: [],
      dailyTimeseries: [],
      weeklyTimeseries: [],
      monthlyTimeseries: [],
      symbolBreakdown: [],
      symbolProfitSource: {
        totalPnL: 0,
        isTotalPositive: false,
        positive: [],
        negative: [],
        zero: [],
        all: []
      },
      exitBreakdown: [],
      typeBreakdown: { buy: { count: 0, pnl: 0 }, sell: { count: 0, pnl: 0 } },
      weekdayMap: {},
      weekdayCount: {},
      weekdayWins: {},
      weekdayLosses: {},
      profitableDay: null,
      lossingDay: null,
      durationMetrics: this.getEmptyDurationMetrics(),
      lotMetrics: this.getEmptyLotMetrics()
    };
  }
};

if (typeof window !== 'undefined') {
  window.TradeAnalytics = TradeAnalytics;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TradeAnalytics;
}
if (typeof globalThis !== 'undefined') {
  globalThis.TradeAnalytics = TradeAnalytics;
}

