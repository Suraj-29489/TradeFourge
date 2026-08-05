/**
 * TradeFourge Companion Extension — Portfolio Exposure & Allocation Tracker
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgePortfolioExposure = factory(root.TradeFourgeDerivedEvents);
  }
})(typeof self !== 'undefined' ? self : this, function (DerivedEvents) {

  function calculateExposure(openPositionsMap) {
    const symbolLotsMap = new Map();
    let totalLots = 0;

    if (openPositionsMap && typeof openPositionsMap.values === 'function') {
      for (const pos of openPositionsMap.values()) {
        const symbol = pos.symbol || 'UNKNOWN';
        const vol = pos.volume || 0;
        totalLots += vol;
        const current = symbolLotsMap.get(symbol) || 0;
        symbolLotsMap.set(symbol, current + vol);
      }
    }

    const allocations = [];
    symbolLotsMap.forEach((lots, symbol) => {
      const percentage = totalLots > 0 ? parseFloat(((lots / totalLots) * 100).toFixed(2)) : 0;
      allocations.push({
        symbol: symbol,
        lots: parseFloat(lots.toFixed(2)),
        percentage: percentage
      });
    });

    const Derived = DerivedEvents || (typeof window !== 'undefined' && window.TradeFourgeDerivedEvents);
    if (Derived && typeof Derived.PortfolioUpdatedEvent === 'function') {
      return Derived.PortfolioUpdatedEvent({
        totalLots: parseFloat(totalLots.toFixed(2)),
        allocations: allocations
      });
    }

    return null;
  }

  return {
    calculateExposure: calculateExposure
  };
});
