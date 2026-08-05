/**
 * TradeFourge Companion Extension — Validation Layer
 *
 * Safely checks frame payload integrity.
 * Filters empty, binary, malformed, or ping-pong payloads without throwing errors.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeValidator = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function isValidPayload(payload) {
    if (payload === null || payload === undefined) return false;

    // Filter out binary payloads (ArrayBuffer / Blob / DataView) for JSON parsers in v1
    if (typeof Blob !== 'undefined' && payload instanceof Blob) return false;
    if (payload instanceof ArrayBuffer || ArrayBuffer.isView(payload)) return false;

    if (typeof payload !== 'string') return false;

    const trimmed = payload.trim();
    if (trimmed.length === 0) return false;

    // Filter control frames (e.g. heartbeat ping/pong "2", "3", "40", "pong")
    if (trimmed === '2' || trimmed === '3' || trimmed === 'pong' || trimmed === 'ping') return false;

    return true;
  }

  function tryParseJSON(payload) {
    if (!isValidPayload(payload)) return null;

    try {
      let textToParse = payload.trim();

      // Handle Engine.IO / Socket.IO frame prefixing (e.g., "42[\"tick\", ...]")
      const socketIoMatch = textToParse.match(/^\d+([\[\{].*[\}\]])$/);
      if (socketIoMatch) {
        textToParse = socketIoMatch[1];
      }

      const parsed = JSON.parse(textToParse);
      return parsed;
    } catch (e) {
      // Malformed JSON -> Return null safely without throwing
      return null;
    }
  }

  return {
    isValidPayload: isValidPayload,
    tryParseJSON: tryParseJSON
  };
});
