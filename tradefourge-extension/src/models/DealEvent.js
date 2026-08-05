/**
 * TradeFourge Companion Extension — Deal Event Model
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeDealEvent = factory(root.TradeFourgeBaseEvent, root.TradeFourgeEventTypes);
  }
})(typeof self !== 'undefined' ? self : this, function (BaseEvent, EventTypes) {
  const TYPE = (EventTypes && EventTypes.DEAL) ? EventTypes.DEAL : 'DEAL';

  function DealEvent(data, rawPayload, socketUrl) {
    if (BaseEvent) {
      BaseEvent.call(this, TYPE, rawPayload, socketUrl);
    } else {
      this.id = 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      this.type = TYPE;
      this.timestamp = new Date().toISOString();
      this.broker = 'Exness';
      this.rawPayload = rawPayload || null;
    }

    this.dealTicket = (data && data.dealTicket) ? String(data.dealTicket) : '';
    this.positionTicket = (data && data.positionTicket) ? String(data.positionTicket) : '';
    this.symbol = (data && data.symbol) ? String(data.symbol).toUpperCase() : 'UNKNOWN';
    this.direction = (data && data.direction) ? String(data.direction).toUpperCase() : 'LONG';
    this.volume = (data && typeof data.volume === 'number') ? data.volume : 0;
    this.price = (data && typeof data.price === 'number') ? data.price : 0;
    this.profit = (data && typeof data.profit === 'number') ? data.profit : 0;
    this.commission = (data && typeof data.commission === 'number') ? data.commission : 0;
    this.swap = (data && typeof data.swap === 'number') ? data.swap : 0;
  }

  if (BaseEvent) {
    DealEvent.prototype = Object.create(BaseEvent.prototype);
    DealEvent.prototype.constructor = DealEvent;
  }

  return DealEvent;
});
