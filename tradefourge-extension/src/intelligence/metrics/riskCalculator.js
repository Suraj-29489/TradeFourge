/**
 * TradeFourge Companion Extension — Risk & Exposure Engine
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeRiskCalculator = factory(root.TradeFourgeDerivedEvents);
  }
})(typeof self !== 'undefined' ? self : this, function (DerivedEvents) {

  function calculateRisk(openPositionsMap, accountState) {
    const equity = (accountState && accountState.equity) ? accountState.equity : 1;
    const balance = (accountState && accountState.balance) ? accountState.balance : equity;
    const margin = (accountState && accountState.margin) ? accountState.margin : 0;

    let totalLots = 0;
    let largestPositionLots = 0;

    if (openPositionsMap && typeof openPositionsMap.values === 'function') {
      for (const pos of openPositionsMap.values()) {
        const vol = pos.volume || 0;
        totalLots += vol;
        if (vol > largestPositionLots) {
          largestPositionLots = vol;
        }
      }
    }

    totalLots = parseFloat(totalLots.toFixed(2));
    const marginUsagePercent = equity > 0 ? parseFloat(((margin / equity) * 100).toFixed(2)) : 0;
    const exposurePercent = equity > 0 ? parseFloat(((margin / equity) * 100).toFixed(2)) : 0;
    const largestPositionPercent = totalLots > 0 ? parseFloat(((largestPositionLots / totalLots) * 100).toFixed(2)) : 0;

    const Derived = DerivedEvents || (typeof window !== 'undefined' && window.TradeFourgeDerivedEvents);
    if (Derived && typeof Derived.ExposureChangedEvent === 'function') {
      return Derived.ExposureChangedEvent({
        totalLots: totalLots,
        marginUsagePercent: marginUsagePercent,
        exposurePercent: exposurePercent,
        largestPositionPercent: largestPositionPercent,
        openPositionsCount: openPositionsMap ? openPositionsMap.size : 0
      });
    }

    return null;
  }

  return {
    calculateRisk: calculateRisk
  };
});
