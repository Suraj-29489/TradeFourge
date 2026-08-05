/**
 * TradeFourge Companion Extension — Order Event Model
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeOrderEvent = factory(root.TradeFourgeBaseEvent, root.TradeFourgeEventTypes);
  }
})(typeof self !== 'undefined' ? self : this, function (BaseEvent, EventTypes) {
  const TYPE = (EventTypes && EventTypes.ORDER) ? EventTypes.ORDER : 'ORDER';

  function OrderEvent(data, rawPayload, socketUrl) {
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
    this.orderType = (data && data.orderType) ? String(data.orderType).toUpperCase() : 'BUY_LIMIT';
    this.volume = (data && typeof data.volume === 'number') ? data.volume : 0;
    this.price = (data && typeof data.price === 'number') ? data.price : 0;
    this.sl = (data && typeof data.sl === 'number') ? data.sl : 0;
    this.tp = (data && typeof data.tp === 'number') ? data.tp : 0;
    this.state = (data && data.state) ? String(data.state).toUpperCase() : 'PENDING';
  }

  if (BaseEvent) {
    OrderEvent.prototype = Object.create(BaseEvent.prototype);
    OrderEvent.prototype.constructor = OrderEvent;
  }

  return OrderEvent;
});
