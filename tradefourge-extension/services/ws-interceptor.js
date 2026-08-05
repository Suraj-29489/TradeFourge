/**
 * TradeFourge Extension WebSocket Interceptor Service
 * Safely hooks native WebSocket API without altering behavior, timing, or payloads.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeWSInterceptor = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  let isInitialized = false;

  function calculateSize(payload) {
    if (!payload) return 0;
    if (typeof payload === 'string') return new TextEncoder().encode(payload).length;
    if (payload instanceof ArrayBuffer) return payload.byteLength;
    if (ArrayBuffer.isView(payload)) return payload.byteLength;
    if (typeof Blob !== 'undefined' && payload instanceof Blob) return payload.size;
    return 0;
  }

  function safeLogAndPost(direction, url, payload) {
    try {
      const size = calculateSize(payload);
      const timestamp = new Date().toISOString();

      const title = direction === 'INCOMING' ? 'Incoming WebSocket Message' : 'Outgoing WebSocket Message';

      // Log matching prompt specification
      console.log(
        `%c[TradeFourge Extension]\n\n%c${title}\n\n` +
        `Timestamp: ${timestamp}\n` +
        `Socket URL: ${url}\n` +
        `Direction: ${direction}\n` +
        `Payload Size: ${size} bytes\n` +
        `Raw Payload:`,
        'color: #00e5ff; font-weight: bold;',
        'color: #76ff03; font-weight: bold;',
        payload
      );

      // Notify content script via window.postMessage
      if (typeof window !== 'undefined' && window.postMessage) {
        window.postMessage({
          source: 'tradefourge-injected',
          type: 'WS_MESSAGE_CAPTURED',
          detail: {
            direction: direction,
            url: url,
            size: size,
            timestamp: timestamp
          }
        }, '*');
      }
    } catch (err) {
      // Interception errors must NEVER crash page logic
    }
  }

  function init() {
    if (isInitialized) return true;
    if (typeof window === 'undefined' || !window.WebSocket) return false;

    const NativeWebSocket = window.WebSocket;

    // Create wrapper constructor
    function WrappedWebSocket(url, protocols) {
      let instance;
      if (protocols !== undefined) {
        instance = new NativeWebSocket(url, protocols);
      } else {
        instance = new NativeWebSocket(url);
      }

      const socketUrl = String(url);

      // Hook send method on instance
      const nativeSend = instance.send;
      instance.send = function (data) {
        safeLogAndPost('OUTGOING', socketUrl, data);
        return nativeSend.apply(this, arguments);
      };

      // Hook addEventListener for message events
      const nativeAddEventListener = instance.addEventListener;
      instance.addEventListener = function (type, listener, options) {
        if (type === 'message' && typeof listener === 'function') {
          const wrappedListener = function (event) {
            safeLogAndPost('INCOMING', socketUrl, event.data);
            return listener.apply(this, arguments);
          };
          return nativeAddEventListener.call(this, type, wrappedListener, options);
        }
        return nativeAddEventListener.apply(this, arguments);
      };

      // Hook onmessage property descriptor setter
      let _onmessage = null;
      Object.defineProperty(instance, 'onmessage', {
        get: function () {
          return _onmessage;
        },
        set: function (fn) {
          if (typeof fn === 'function') {
            _onmessage = function (event) {
              safeLogAndPost('INCOMING', socketUrl, event.data);
              return fn.apply(this, arguments);
            };
          } else {
            _onmessage = null;
          }
          nativeAddEventListener.call(instance, 'message', _onmessage);
        },
        configurable: true,
        enumerable: true
      });

      return instance;
    }

    // Preserve prototype chain and static constants
    WrappedWebSocket.prototype = NativeWebSocket.prototype;
    WrappedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    WrappedWebSocket.OPEN = NativeWebSocket.OPEN;
    WrappedWebSocket.CLOSING = NativeWebSocket.CLOSING;
    WrappedWebSocket.CLOSED = NativeWebSocket.CLOSED;

    // Assign to window.WebSocket
    window.WebSocket = WrappedWebSocket;
    isInitialized = true;
    return true;
  }

  return {
    init: init,
    isInitialized: function () { return isInitialized; }
  };
});
