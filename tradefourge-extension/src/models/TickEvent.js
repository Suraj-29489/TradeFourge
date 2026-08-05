/**
 * TradeFourge Companion Extension — Tick Event Model
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeTickEvent = factory(root.TradeFourgeBaseEvent, root.TradeFourgeEventTypes);
  }
})(typeof self !== 'undefined' ? self : this, function (BaseEvent, EventTypes) {
  const TYPE = (EventTypes && EventTypes.TICK) ? EventTypes.TICK : 'TICK';

  function TickEvent(data, rawPayload, socketUrl) {
    if (BaseEvent) {
      BaseEvent.call(this, TYPE, rawPayload, socketUrl);
    } else {
      this.id = 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      this.type = TYPE;
      this.timestamp = new Date().toISOString();
      this.broker = 'Exness';
      this.rawPayload = rawPayload || null;
    }

    this.instrument = (data && data.instrument) ? String(data.instrument).toUpperCase() : 'UNKNOWN';
    this.bid = (data && typeof data.bid === 'number') ? data.bid : 0;
    this.ask = (data && typeof data.ask === 'number') ? data.ask : 0;
    this.digits = (data && typeof data.digits === 'number') ? data.digits : 5;
    
    // Spread calculation: ask - bid
    const rawSpread = Math.max(0, this.ask - this.bid);
    this.spread = parseFloat(rawSpread.toFixed(this.digits));
  }

  if (BaseEvent) {
    TickEvent.prototype = Object.create(BaseEvent.prototype);
    TickEvent.prototype.constructor = TickEvent;
  }

  return TickEvent;
});
