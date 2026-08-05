/**
 * TradeFourge Companion Extension — Spread & Tick Velocity Tracker
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeSpreadTracker = factory(root.TradeFourgeDerivedEvents);
  }
})(typeof self !== 'undefined' ? self : this, function (DerivedEvents) {

  const symbolStats = new Map();

  function processTick(tickEvent) {
    if (!tickEvent || tickEvent.type !== 'TICK' || !tickEvent.instrument) return null;

    const symbol = tickEvent.instrument;
    const spread = tickEvent.spread;
    const now = Date.now();

    let stats = symbolStats.get(symbol);
    if (!stats) {
      stats = {
        symbol: symbol,
        currentSpread: spread,
        minSpread: spread,
        maxSpread: spread,
        totalSpreadSum: spread,
        tickCount: 1,
        averageSpread: spread,
        lastTickTime: now,
        priceVelocity: 0,
        lastBid: tickEvent.bid
      };
      symbolStats.set(symbol, stats);
    } else {
      const timeDelta = Math.max(1, now - stats.lastTickTime);
      const priceDelta = Math.abs(tickEvent.bid - stats.lastBid);
      stats.priceVelocity = parseFloat((priceDelta / (timeDelta / 1000)).toFixed(5));

      stats.currentSpread = spread;
      stats.minSpread = Math.min(stats.minSpread, spread);
      stats.maxSpread = Math.max(stats.maxSpread, spread);
      stats.totalSpreadSum += spread;
      stats.tickCount++;
      stats.averageSpread = parseFloat((stats.totalSpreadSum / stats.tickCount).toFixed(tickEvent.digits || 5));
      stats.lastTickTime = now;
      stats.lastBid = tickEvent.bid;
    }

    const Derived = DerivedEvents || (typeof window !== 'undefined' && window.TradeFourgeDerivedEvents);
    if (Derived && typeof Derived.SpreadChangedEvent === 'function') {
      return Derived.SpreadChangedEvent({
        symbol: symbol,
        spread: stats.currentSpread,
        averageSpread: stats.averageSpread,
        minSpread: stats.minSpread,
        maxSpread: stats.maxSpread,
        velocity: stats.priceVelocity
      });
    }

    return null;
  }

  function getStats(symbol) {
    return symbolStats.get(symbol) || null;
  }

  return {
    processTick: processTick,
    getStats: getStats
  };
});
