/**
 * TradeFourge Companion Extension — Equity Intelligence Tracker
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeEquityTracker = factory(root.TradeFourgeDerivedEvents);
  }
})(typeof self !== 'undefined' ? self : this, function (DerivedEvents) {

  let peakEquity = 0;
  let lowestEquity = Infinity;
  let startingBalanceDay = 0;

  function processAccountUpdate(accountEvent) {
    if (!accountEvent || typeof accountEvent.equity !== 'number') return [];

    const equity = accountEvent.equity;
    const balance = accountEvent.balance || equity;
    const events = [];

    if (startingBalanceDay === 0) {
      startingBalanceDay = balance;
    }

    const Derived = DerivedEvents || (typeof window !== 'undefined' && window.TradeFourgeDerivedEvents);

    if (equity > peakEquity) {
      peakEquity = equity;
      if (Derived && typeof Derived.EquityHighEvent === 'function') {
        events.push(Derived.EquityHighEvent({
          peakEquity: peakEquity,
          balance: balance,
          gain: parseFloat((equity - startingBalanceDay).toFixed(2))
        }));
      }
    }

    if (equity < lowestEquity && equity > 0) {
      lowestEquity = equity;
      if (Derived && typeof Derived.EquityLowEvent === 'function') {
        events.push(Derived.EquityLowEvent({
          lowestEquity: lowestEquity,
          balance: balance,
          loss: parseFloat((startingBalanceDay - equity).toFixed(2))
        }));
      }
    }

    return events;
  }

  function getPeakEquity() { return peakEquity; }
  function getLowestEquity() { return lowestEquity === Infinity ? 0 : lowestEquity; }

  return {
    processAccountUpdate: processAccountUpdate,
    getPeakEquity: getPeakEquity,
    getLowestEquity: getLowestEquity
  };
});
