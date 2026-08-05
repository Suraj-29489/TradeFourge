/**
 * TradeFourge Companion Extension — Order Parser
 *
 * Parses pending order payloads and converts them to OrderEvent instances.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeOrderParser = factory(root.TradeFourgeOrderEvent);
  }
})(typeof self !== 'undefined' ? self : this, function (OrderEvent) {

  function isOrderPayload(data) {
    if (!data || typeof data !== 'object') return false;

    if (Array.isArray(data)) {
      const eventName = data[0];
      if (typeof eventName === 'string' && (eventName.includes('order') || eventName.includes('pending'))) return true;
      if (data[1] && typeof data[1] === 'object') return isOrderPayload(data[1]);
      return false;
    }

    const hasOrderKey = !!(data.order || data.orders || data.type === 'order');
    const rawType = String(data.orderType || data.type || '').toUpperCase();
    const isPendingType = rawType.includes('LIMIT') || rawType.includes('STOP') || rawType.includes('PENDING');

    return hasOrderKey || isPendingType;
  }

  function parse(parsedJson, rawPayload, socketUrl) {
    if (!isOrderPayload(parsedJson)) return null;

    let targetObj = parsedJson;
    if (Array.isArray(parsedJson)) {
      targetObj = typeof parsedJson[1] === 'object' ? parsedJson[1] : parsedJson[0];
    }

    const ticket = targetObj.ticket || targetObj.orderId || targetObj.id || '';
    const symbol = targetObj.symbol || targetObj.item || 'UNKNOWN';
    const orderType = String(targetObj.orderType || targetObj.type || 'BUY_LIMIT').toUpperCase();

    const volume = typeof targetObj.volume === 'number' ? targetObj.volume : (typeof targetObj.lots === 'number' ? targetObj.lots : 0);
    const price = typeof targetObj.price === 'number' ? targetObj.price : (typeof targetObj.openPrice === 'number' ? targetObj.openPrice : 0);
    const sl = typeof targetObj.sl === 'number' ? targetObj.sl : (typeof targetObj.stopLoss === 'number' ? targetObj.stopLoss : 0);
    const tp = typeof targetObj.tp === 'number' ? targetObj.tp : (typeof targetObj.takeProfit === 'number' ? targetObj.takeProfit : 0);
    const state = String(targetObj.state || targetObj.status || 'PENDING').toUpperCase();

    const EventConstructor = OrderEvent || (window && window.TradeFourgeOrderEvent);
    if (!EventConstructor) return null;

    return new EventConstructor({
      ticket: ticket,
      symbol: symbol,
      orderType: orderType,
      volume: volume,
      price: price,
      sl: sl,
      tp: tp,
      state: state
    }, rawPayload, socketUrl);
  }

  return {
    name: 'OrderParser',
    isOrderPayload: isOrderPayload,
    parse: parse
  };
});
