/**
 * TradeFourge Companion Extension — Drawdown Intelligence Engine
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeDrawdownTracker = factory(root.TradeFourgeDerivedEvents);
  }
})(typeof self !== 'undefined' ? self : this, function (DerivedEvents) {

  let peakEquity = 0;
  let currentDrawdownAmount = 0;
  let currentDrawdownPercent = 0;
  let maxDrawdownPercent = 0;

  function update(equity, balance) {
    if (typeof equity !== 'number' || equity <= 0) return null;

    if (equity > peakEquity) {
      peakEquity = equity;
      currentDrawdownAmount = 0;
      currentDrawdownPercent = 0;
    } else {
      currentDrawdownAmount = parseFloat((peakEquity - equity).toFixed(2));
      currentDrawdownPercent = parseFloat(((currentDrawdownAmount / peakEquity) * 100).toFixed(2));
      maxDrawdownPercent = Math.max(maxDrawdownPercent, currentDrawdownPercent);
    }

    const recoveryPercent = currentDrawdownPercent === 0 ? 100 : parseFloat((((equity - (peakEquity - currentDrawdownAmount)) / currentDrawdownAmount) * 100).toFixed(2));

    const Derived = DerivedEvents || (typeof window !== 'undefined' && window.TradeFourgeDerivedEvents);
    if (Derived && typeof Derived.DrawdownChangedEvent === 'function') {
      return Derived.DrawdownChangedEvent({
        drawdownAmount: currentDrawdownAmount,
        drawdownPercent: currentDrawdownPercent,
        maxDrawdownPercent: maxDrawdownPercent,
        recoveryPercent: recoveryPercent,
        peakEquity: peakEquity
      });
    }

    return null;
  }

  function getDrawdown() {
    return {
      amount: currentDrawdownAmount,
      percent: currentDrawdownPercent,
      maxPercent: maxDrawdownPercent,
      peakEquity: peakEquity
    };
  }

  return {
    update: update,
    getDrawdown: getDrawdown
  };
});
