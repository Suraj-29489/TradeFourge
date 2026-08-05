/**
 * TradeFourge Companion Extension — Capture Layer
 *
 * Receives raw WebSocket frames from inject.js and passes them directly to the Validator Layer.
 * Performs NO parsing or business logic.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeCapture = factory(
      root.TradeFourgeValidator,
      root.TradeFourgeParserManager
    );
  }
})(typeof self !== 'undefined' ? self : this, function (Validator, ParserManager) {

  function captureFrame(direction, socketUrl, rawPayload, timestamp) {
    const val = Validator || (typeof window !== 'undefined' && window.TradeFourgeValidator);
    const parser = ParserManager || (typeof window !== 'undefined' && window.TradeFourgeParserManager);

    if (!val || !val.isValidPayload(rawPayload)) {
      return;
    }

    const parsedJson = val.tryParseJSON(rawPayload);
    if (parsedJson && parser && typeof parser.parseAndDispatch === 'function') {
      parser.parseAndDispatch(parsedJson, rawPayload, socketUrl);
    }
  }

  return {
    captureFrame: captureFrame
  };
});
