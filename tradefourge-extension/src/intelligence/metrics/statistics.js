/**
 * TradeFourge Companion Extension — Cumulative Statistics Engine
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeStatistics = factory(
      root.TradeFourgePerformanceTracker,
      root.TradeFourgeTradeDuration,
      root.TradeFourgeDerivedEvents
    );
  }
})(typeof self !== 'undefined' ? self : this, function (PerformanceTracker, TradeDuration, DerivedEvents) {

  function update(profit) {
    const perf = PerformanceTracker || (typeof window !== 'undefined' && window.TradeFourgePerformanceTracker);
    const dur = TradeDuration || (typeof window !== 'undefined' && window.TradeFourgeTradeDuration);
    const Derived = DerivedEvents || (typeof window !== 'undefined' && window.TradeFourgeDerivedEvents);

    if (perf && typeof perf.processClosedTrade === 'function') {
      perf.processClosedTrade(profit);
    }

    const currentStats = perf ? perf.getStats() : {};
    const avgHoldTime = dur ? dur.getAverageHoldTimeFormatted() : '00:00:00';

    if (Derived && typeof Derived.StatisticsUpdatedEvent === 'function') {
      return Derived.StatisticsUpdatedEvent({
        stats: currentStats,
        averageHoldTime: avgHoldTime
      });
    }

    return null;
  }

  return {
    update: update
  };
});
