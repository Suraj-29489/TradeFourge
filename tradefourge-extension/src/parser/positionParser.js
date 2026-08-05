/**
 * TradeFourge Companion Extension — Position Parser
 *
 * Parses position updates and converts them to PositionEvent instances.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgePositionParser = factory(root.TradeFourgePositionEvent);
  }
})(typeof self !== 'undefined' ? self : this, function (PositionEvent) {

  function isPositionPayload(data) {
    if (!data || typeof data !== 'object') return false;

    if (Array.isArray(data)) {
      const eventName = data[0];
      if (typeof eventName === 'string' && (eventName.includes('position') || eventName.includes('pos_'))) return true;
      if (data[1] && typeof data[1] === 'object') return isPositionPayload(data[1]);
      return false;
    }

    const hasTicket = !!(data.ticket || data.positionId || data.pos || data.id);
    const hasPositionKey = !!(data.position || data.positions || data.type === 'position');
    const hasProfitOrVol = (typeof data.profit === 'number' || typeof data.pnl === 'number' || typeof data.volume === 'number' || typeof data.lots === 'number');

    return (hasTicket && hasProfitOrVol) || hasPositionKey;
  }

  function parse(parsedJson, rawPayload, socketUrl) {
    if (!isPositionPayload(parsedJson)) return null;

    let targetObj = parsedJson;
    if (Array.isArray(parsedJson)) {
      targetObj = typeof parsedJson[1] === 'object' ? parsedJson[1] : parsedJson[0];
    }

    const ticket = targetObj.ticket || targetObj.positionId || targetObj.pos || targetObj.id || '';
    const symbol = targetObj.symbol || targetObj.item || targetObj.pair || 'UNKNOWN';
    const rawDir = String(targetObj.direction || targetObj.type || targetObj.side || 'LONG').toUpperCase();
    const direction = rawDir.includes('SHORT') || rawDir.includes('SELL') ? 'SHORT' : 'LONG';

    const volume = typeof targetObj.volume === 'number' ? targetObj.volume : (typeof targetObj.lots === 'number' ? targetObj.lots : 0);
    const entryPrice = typeof targetObj.entryPrice === 'number' ? targetObj.entryPrice : (typeof targetObj.openPrice === 'number' ? targetObj.openPrice : 0);
    const currentPrice = typeof targetObj.currentPrice === 'number' ? targetObj.currentPrice : (typeof targetObj.price === 'number' ? targetObj.price : entryPrice);
    const sl = typeof targetObj.sl === 'number' ? targetObj.sl : (typeof targetObj.stopLoss === 'number' ? targetObj.stopLoss : 0);
    const tp = typeof targetObj.tp === 'number' ? targetObj.tp : (typeof targetObj.takeProfit === 'number' ? targetObj.takeProfit : 0);
    const profit = typeof targetObj.profit === 'number' ? targetObj.profit : (typeof targetObj.pnl === 'number' ? targetObj.pnl : 0);
    const action = String(targetObj.action || targetObj.status || 'UPDATE').toUpperCase();

    const EventConstructor = PositionEvent || (window && window.TradeFourgePositionEvent);
    if (!EventConstructor) return null;

    return new EventConstructor({
      ticket: ticket,
      symbol: symbol,
      direction: direction,
      volume: volume,
      entryPrice: entryPrice,
      currentPrice: currentPrice,
      sl: sl,
      tp: tp,
      profit: profit,
      action: action
    }, rawPayload, socketUrl);
  }

  return {
    name: 'PositionParser',
    isPositionPayload: isPositionPayload,
    parse: parse
  };
});
