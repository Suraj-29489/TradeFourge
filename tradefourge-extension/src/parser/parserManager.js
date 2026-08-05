/**
 * TradeFourge Companion Extension — Parser Manager
 *
 * Coordinates specialized parsers (Tick, Position, Order, Deal, Account).
 * Normalizes raw frames into typed TradeFourge events and dispatches them.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeParserManager = factory(
      root.TradeFourgeTickParser,
      root.TradeFourgePositionParser,
      root.TradeFourgeOrderParser,
      root.TradeFourgeDealParser,
      root.TradeFourgeAccountParser,
      root.TradeFourgeBaseEvent,
      root.TradeFourgeDispatcher
    );
  }
})(typeof self !== 'undefined' ? self : this, function (
  TickParser, PositionParser, OrderParser, DealParser, AccountParser, BaseEvent, Dispatcher
) {

  const parsers = [
    TickParser,
    PositionParser,
    OrderParser,
    DealParser,
    AccountParser
  ];

  function getParsers() {
    return [
      TickParser || (window && window.TradeFourgeTickParser),
      PositionParser || (window && window.TradeFourgePositionParser),
      OrderParser || (window && window.TradeFourgeOrderParser),
      DealParser || (window && window.TradeFourgeDealParser),
      AccountParser || (window && window.TradeFourgeAccountParser)
    ].filter(Boolean);
  }

  function parseAndDispatch(parsedJson, rawPayload, socketUrl) {
    const activeParsers = getParsers();
    let event = null;

    for (let i = 0; i < activeParsers.length; i++) {
      const parser = activeParsers[i];
      if (parser && typeof parser.parse === 'function') {
        try {
          const result = parser.parse(parsedJson, rawPayload, socketUrl);
          if (result) {
            event = result;
            break;
          }
        } catch (err) {
          // Individual parser failures must never crash the pipeline
        }
      }
    }

    // Fallback if no specific parser matched
    if (!event) {
      const BaseEvt = BaseEvent || (window && window.TradeFourgeBaseEvent);
      if (BaseEvt) {
        event = new BaseEvt('RAW_UNKNOWN', rawPayload, socketUrl);
      }
    }

    if (event) {
      const disp = Dispatcher || (window && window.TradeFourgeDispatcher);
      if (disp && typeof disp.dispatch === 'function') {
        disp.dispatch(event);
      }
    }

    return event;
  }

  return {
    parseAndDispatch: parseAndDispatch
  };
});
