/**
 * TradeFourge Companion Extension — Base Event Model
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeBaseEvent = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function BaseEvent(type, rawPayload, socketUrl) {
    this.id = 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    this.type = type || 'RAW_UNKNOWN';
    this.timestamp = new Date().toISOString();
    this.socketUrl = socketUrl || '';
    this.broker = 'Exness';
    this.rawPayload = rawPayload !== undefined ? rawPayload : null;
  }

  return BaseEvent;
});
