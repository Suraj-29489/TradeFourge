/**
 * TradeFourge Companion Extension — Position Event Model
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgePositionEvent = factory(root.TradeFourgeBaseEvent, root.TradeFourgeEventTypes);
  }
})(typeof self !== 'undefined' ? self : this, function (BaseEvent, EventTypes) {
  const TYPE = (EventTypes && EventTypes.POSITION) ? EventTypes.POSITION : 'POSITION';

  function PositionEvent(data, rawPayload, socketUrl) {
    if (BaseEvent) {
      BaseEvent.call(this, TYPE, rawPayload, socketUrl);
    } else {
      this.id = 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      this.type = TYPE;
      this.timestamp = new Date().toISOString();
      this.broker = 'Exness';
      this.rawPayload = rawPayload || null;
    }

    this.ticket = (data && data.ticket) ? String(data.ticket) : '';
    this.symbol = (data && data.symbol) ? String(data.symbol).toUpperCase() : 'UNKNOWN';
    this.direction = (data && data.direction) ? String(data.direction).toUpperCase() : 'LONG';
    this.volume = (data && typeof data.volume === 'number') ? data.volume : 0;
    this.entryPrice = (data && typeof data.entryPrice === 'number') ? data.entryPrice : 0;
    this.currentPrice = (data && typeof data.currentPrice === 'number') ? data.currentPrice : this.entryPrice;
    this.sl = (data && typeof data.sl === 'number') ? data.sl : 0;
    this.tp = (data && typeof data.tp === 'number') ? data.tp : 0;
    this.profit = (data && typeof data.profit === 'number') ? data.profit : 0;
    this.action = (data && data.action) ? String(data.action).toUpperCase() : 'UPDATE';
  }

  if (BaseEvent) {
    PositionEvent.prototype = Object.create(BaseEvent.prototype);
    PositionEvent.prototype.constructor = PositionEvent;
  }

  return PositionEvent;
});
