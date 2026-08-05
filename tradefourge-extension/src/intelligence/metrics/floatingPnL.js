/**
 * TradeFourge Companion Extension — Floating PnL Engine
 *
 * Real-time calculation of unrealized profit/loss, highest floating profit, and floating drawdown.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeFloatingPnL = factory(root.TradeFourgeDerivedEvents);
  }
})(typeof self !== 'undefined' ? self : this, function (DerivedEvents) {

  const positionTracking = new Map();

  function updatePositionTick(position, tickEvent) {
    if (!position || !tickEvent || position.symbol !== tickEvent.instrument) return null;

    const isLong = position.direction === 'LONG';
    const currentPrice = isLong ? tickEvent.bid : tickEvent.ask;
    const entryPrice = position.entryPrice;

    // Approximate floating profit if not directly supplied by Exness
    const priceDiff = isLong ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
    const volume = position.volume || 0.01;
    // Standard contract size factor (e.g. 100,000 for FX, 100 for Gold)
    const multiplier = position.symbol.includes('XAU') ? 100 : (position.symbol.includes('BTC') ? 1 : 100000);
    const estimatedPnl = parseFloat((priceDiff * volume * multiplier).toFixed(2));
    const profit = position.profit !== undefined ? position.profit : estimatedPnl;

    let tracking = positionTracking.get(position.ticket);
    if (!tracking) {
      tracking = {
        ticket: position.ticket,
        highestProfit: profit,
        lowestProfit: profit,
        currentProfit: profit
      };
      positionTracking.set(position.ticket, tracking);
    } else {
      tracking.currentProfit = profit;
      tracking.highestProfit = Math.max(tracking.highestProfit, profit);
      tracking.lowestProfit = Math.min(tracking.lowestProfit, profit);
    }

    const Derived = DerivedEvents || (typeof window !== 'undefined' && window.TradeFourgeDerivedEvents);
    if (Derived && typeof Derived.FloatingProfitChangedEvent === 'function') {
      return Derived.FloatingProfitChangedEvent({
        ticket: position.ticket,
        symbol: position.symbol,
        floatingProfit: tracking.currentProfit,
        highestProfit: tracking.highestProfit,
        lowestProfit: tracking.lowestProfit,
        currentPrice: currentPrice
      });
    }

    return null;
  }

  function removePosition(ticket) {
    positionTracking.delete(ticket);
  }

  return {
    updatePositionTick: updatePositionTick,
    removePosition: removePosition
  };
});
