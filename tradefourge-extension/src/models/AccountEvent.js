/**
 * TradeFourge Companion Extension — Account Event Model
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeAccountEvent = factory(root.TradeFourgeBaseEvent, root.TradeFourgeEventTypes);
  }
})(typeof self !== 'undefined' ? self : this, function (BaseEvent, EventTypes) {
  const TYPE = (EventTypes && EventTypes.ACCOUNT) ? EventTypes.ACCOUNT : 'ACCOUNT';

  function AccountEvent(data, rawPayload, socketUrl) {
    if (BaseEvent) {
      BaseEvent.call(this, TYPE, rawPayload, socketUrl);
    } else {
      this.id = 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      this.type = TYPE;
      this.timestamp = new Date().toISOString();
      this.broker = 'Exness';
      this.rawPayload = rawPayload || null;
    }

    this.accountNumber = (data && data.accountNumber) ? String(data.accountNumber) : 'UNKNOWN';
    this.currency = (data && data.currency) ? String(data.currency).toUpperCase() : 'USD';
    this.balance = (data && typeof data.balance === 'number') ? data.balance : 0;
    this.equity = (data && typeof data.equity === 'number') ? data.equity : this.balance;
    this.margin = (data && typeof data.margin === 'number') ? data.margin : 0;
    this.freeMargin = (data && typeof data.freeMargin === 'number') ? data.freeMargin : Math.max(0, this.equity - this.margin);
    this.marginLevel = (data && typeof data.marginLevel === 'number') ? data.marginLevel : (this.margin > 0 ? (this.equity / this.margin) * 100 : 0);
    this.leverage = (data && typeof data.leverage === 'number') ? data.leverage : 100;
  }

  if (BaseEvent) {
    AccountEvent.prototype = Object.create(BaseEvent.prototype);
    AccountEvent.prototype.constructor = AccountEvent;
  }

  return AccountEvent;
});
