/**
 * TradeFourge Companion Extension — Event Types
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeEventTypes = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  return Object.freeze({
    TICK: 'TICK',
    POSITION: 'POSITION',
    ORDER: 'ORDER',
    DEAL: 'DEAL',
    ACCOUNT: 'ACCOUNT',
    RAW_UNKNOWN: 'RAW_UNKNOWN'
  });
});
