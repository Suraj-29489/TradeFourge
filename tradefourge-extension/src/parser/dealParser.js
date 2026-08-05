/**
 * TradeFourge Companion Extension — Deal Parser
 *
 * Parses trade execution deal payloads and converts them to DealEvent instances.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeDealParser = factory(root.TradeFourgeDealEvent);
  }
})(typeof self !== 'undefined' ? self : this, function (DealEvent) {

  function isDealPayload(data) {
    if (!data || typeof data !== 'object') return false;

    if (Array.isArray(data)) {
      const eventName = data[0];
      if (typeof eventName === 'string' && (eventName.includes('deal') || eventName.includes('execution') || eventName.includes('fill'))) return true;
      if (data[1] && typeof data[1] === 'object') return isDealPayload(data[1]);
      return false;
    }

    const hasDealKey = !!(data.deal || data.dealTicket || data.execution || data.type === 'deal');
    return hasDealKey;
  }

  function parse(parsedJson, rawPayload, socketUrl) {
    if (!isDealPayload(parsedJson)) return null;

    let targetObj = parsedJson;
    if (Array.isArray(parsedJson)) {
      targetObj = typeof parsedJson[1] === 'object' ? parsedJson[1] : parsedJson[0];
    }

    const dealTicket = targetObj.dealTicket || targetObj.deal || targetObj.id || '';
    const positionTicket = targetObj.positionTicket || targetObj.position || targetObj.pos || '';
    const symbol = targetObj.symbol || targetObj.item || 'UNKNOWN';
    const rawDir = String(targetObj.direction || targetObj.side || targetObj.type || 'LONG').toUpperCase();
    const direction = rawDir.includes('SHORT') || rawDir.includes('SELL') ? 'SHORT' : 'LONG';

    const volume = typeof targetObj.volume === 'number' ? targetObj.volume : (typeof targetObj.lots === 'number' ? targetObj.lots : 0);
    const price = typeof targetObj.price === 'number' ? targetObj.price : (typeof targetObj.fillPrice === 'number' ? targetObj.fillPrice : 0);
    const profit = typeof targetObj.profit === 'number' ? targetObj.profit : (typeof targetObj.pnl === 'number' ? targetObj.pnl : 0);
    const commission = typeof targetObj.commission === 'number' ? targetObj.commission : 0;
    const swap = typeof targetObj.swap === 'number' ? targetObj.swap : 0;

    const EventConstructor = DealEvent || (window && window.TradeFourgeDealEvent);
    if (!EventConstructor) return null;

    return new EventConstructor({
      dealTicket: dealTicket,
      positionTicket: positionTicket,
      symbol: symbol,
      direction: direction,
      volume: volume,
      price: price,
      profit: profit,
      commission: commission,
      swap: swap
    }, rawPayload, socketUrl);
  }

  return {
    name: 'DealParser',
    isDealPayload: isDealPayload,
    parse: parse
  };
});
