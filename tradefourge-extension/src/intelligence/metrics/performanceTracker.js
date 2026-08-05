/**
 * TradeFourge Companion Extension — Trading Performance & Win-Rate Tracker
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgePerformanceTracker = factory(root.TradeFourgeDerivedEvents);
  }
})(typeof self !== 'undefined' ? self : this, function (DerivedEvents) {

  const stats = {
    totalClosedTrades: 0,
    winCount: 0,
    lossCount: 0,
    breakevenCount: 0,
    winRate: 0,
    lossRate: 0,
    grossProfit: 0,
    grossLoss: 0,
    profitFactor: 0,
    largestWin: 0,
    largestLoss: 0,
    currentStreak: 0,
    longestWinStreak: 0,
    longestLossStreak: 0
  };

  function processClosedTrade(profit) {
    if (typeof profit !== 'number') return null;

    stats.totalClosedTrades++;

    if (profit > 0.5) {
      stats.winCount++;
      stats.grossProfit += profit;
      stats.largestWin = Math.max(stats.largestWin, profit);

      if (stats.currentStreak >= 0) {
        stats.currentStreak++;
      } else {
        stats.currentStreak = 1;
      }
      stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentStreak);

    } else if (profit < -0.5) {
      stats.lossCount++;
      const absLoss = Math.abs(profit);
      stats.grossLoss += absLoss;
      stats.largestLoss = Math.max(stats.largestLoss, absLoss);

      if (stats.currentStreak <= 0) {
        stats.currentStreak--;
      } else {
        stats.currentStreak = -1;
      }
      stats.longestLossStreak = Math.max(stats.longestLossStreak, Math.abs(stats.currentStreak));

    } else {
      stats.breakevenCount++;
    }

    stats.winRate = stats.totalClosedTrades > 0 ? parseFloat(((stats.winCount / stats.totalClosedTrades) * 100).toFixed(1)) : 0;
    stats.lossRate = stats.totalClosedTrades > 0 ? parseFloat(((stats.lossCount / stats.totalClosedTrades) * 100).toFixed(1)) : 0;
    stats.profitFactor = stats.grossLoss > 0 ? parseFloat((stats.grossProfit / stats.grossLoss).toFixed(2)) : (stats.grossProfit > 0 ? 999.00 : 0);

    const Derived = DerivedEvents || (typeof window !== 'undefined' && window.TradeFourgeDerivedEvents);
    if (Derived && typeof Derived.WinRateUpdatedEvent === 'function') {
      return Derived.WinRateUpdatedEvent({
        winRate: stats.winRate,
        lossRate: stats.lossRate,
        profitFactor: stats.profitFactor,
        winCount: stats.winCount,
        lossCount: stats.lossCount,
        breakevenCount: stats.breakevenCount,
        totalClosedTrades: stats.totalClosedTrades
      });
    }

    return null;
  }

  function getStats() {
    return Object.assign({}, stats);
  }

  return {
    processClosedTrade: processClosedTrade,
    getStats: getStats
  };
});
