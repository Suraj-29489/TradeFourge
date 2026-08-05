/**
 * TradeFourge Extension Unified Logger Utility
 * Provides standardized logging across background, content, and injected scripts.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeLogger = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const PREFIX = '[TradeFourge Extension]';

  const LogLevel = {
    INFO: 'INFO',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG'
  };

  function getTimestamp() {
    return new Date().toISOString();
  }

  function formatLogHeader(level) {
    return `${PREFIX} [${level}] [${getTimestamp()}]`;
  }

  return {
    LogLevel: LogLevel,

    info: function (message, ...args) {
      console.log(`${formatLogHeader(LogLevel.INFO)} ${message}`, ...args);
    },

    warn: function (message, ...args) {
      console.warn(`${formatLogHeader(LogLevel.WARNING)} ${message}`, ...args);
    },

    error: function (message, ...args) {
      console.error(`${formatLogHeader(LogLevel.ERROR)} ${message}`, ...args);
    },

    debug: function (message, ...args) {
      console.debug(`${formatLogHeader(LogLevel.DEBUG)} ${message}`, ...args);
    },

    /**
     * Specialized WebSocket log format adhering strictly to v1 requirements
     * @param {Object} details
     * @param {'INCOMING'|'OUTGOING'} details.direction
     * @param {string} details.socketUrl
     * @param {string|ArrayBuffer|Blob} details.payload
     * @param {number} details.payloadSize
     */
    logWebSocketMessage: function (details) {
      const { direction, socketUrl, payload, payloadSize } = details;
      const title = direction === 'INCOMING' ? 'Incoming WebSocket Message' : 'Outgoing WebSocket Message';
      const timestamp = getTimestamp();

      const logText = `${PREFIX}\n\n${title}\n\n` +
        `Timestamp: ${timestamp}\n` +
        `Socket URL: ${socketUrl}\n` +
        `Direction: ${direction}\n` +
        `Payload Size: ${payloadSize} bytes\n` +
        `Raw Payload:`;

      console.groupCollapsed(`${PREFIX} ${title} (${payloadSize} bytes)`);
      console.log(logText);
      console.log(payload);
      console.groupEnd();
    }
  };
});
