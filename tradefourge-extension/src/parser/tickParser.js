/**
 * TradeFourge Companion Extension — Tick Parser
 *
 * Parses tick quote payloads and converts them to TickEvent instances.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeTickParser = factory(root.TradeFourgeTickEvent);
  }
})(typeof self !== 'undefined' ? self : this, function (TickEvent) {

  function isTickPayload(data) {
    if (!data || typeof data !== 'object') return false;

    // Check array payload (e.g. Socket.IO event: ["quote", { i: "EURUSD", b: ... }])
    if (Array.isArray(data)) {
      const eventName = data[0];
      const payloadObj = data[1];
      if (typeof eventName === 'string' && (eventName.includes('tick') || eventName.includes('quote') || eventName.includes('price'))) {
        return true;
      }
      if (payloadObj && typeof payloadObj === 'object') {
        return isTickPayload(payloadObj);
      }
      return false;
    }

    // Direct object checks (Exness / MT5 Web Terminal tick field names)
    const hasInstrument = !!(data.i || data.instrument || data.symbol || data.s);
    const hasBid = (typeof data.b === 'number' || typeof data.bid === 'number' || typeof data.bp === 'number');
    const hasAsk = (typeof data.a === 'number' || typeof data.ask === 'number' || typeof data.ap === 'number');

    return hasInstrument && (hasBid || hasAsk);
  }

  function parse(parsedJson, rawPayload, socketUrl) {
    if (!isTickPayload(parsedJson)) return null;

    let targetObj = parsedJson;
    if (Array.isArray(parsedJson)) {
      targetObj = typeof parsedJson[1] === 'object' ? parsedJson[1] : parsedJson[0];
    }

    const instrument = targetObj.i || targetObj.instrument || targetObj.symbol || targetObj.s || 'UNKNOWN';
    const bid = typeof targetObj.b === 'number' ? targetObj.b : (typeof targetObj.bid === 'number' ? targetObj.bid : 0);
    const ask = typeof targetObj.a === 'number' ? targetObj.a : (typeof targetObj.ask === 'number' ? targetObj.ask : bid);
    const digits = typeof targetObj.d === 'number' ? targetObj.d : (typeof targetObj.digits === 'number' ? targetObj.digits : 5);

    const EventConstructor = TickEvent || (window && window.TradeFourgeTickEvent);
    if (!EventConstructor) return null;

    return new EventConstructor({
      instrument: instrument,
      bid: bid,
      ask: ask,
      digits: digits
    }, rawPayload, socketUrl);
  }

  return {
    name: 'TickParser',
    isTickPayload: isTickPayload,
    parse: parse
  };
});
