/**
 * TradeFourge Extension — Page Context Injected Script (Main World)
 *
 * Hooks window.WebSocket safely and delegates frame capture to TradeFourgeCapture.
 * Contains ZERO business logic or parsing.
 */

(function () {
  'use strict';

  // Double-initialization guard
  if (window.__TRADEFOURGE_INJECTED__) {
    return;
  }
  window.__TRADEFOURGE_INJECTED__ = true;

  try {
    const NativeWebSocket = window.WebSocket;

    if (!NativeWebSocket) {
      console.warn('[TradeFourge] Native WebSocket API not available in page context.');
      return;
    }

    function forwardFrame(direction, socketUrl, payload) {
      try {
        const timestamp = new Date().toISOString();
        const captureLayer = window.TradeFourgeCapture;
        if (captureLayer && typeof captureLayer.captureFrame === 'function') {
          captureLayer.captureFrame(direction, socketUrl, payload, timestamp);
        }
      } catch (err) {
        // Frame interception must never crash webpage logic
      }
    }

    function TradeFourgeWebSocket(url, protocols) {
      let instance;
      if (protocols !== undefined) {
        instance = new NativeWebSocket(url, protocols);
      } else {
        instance = new NativeWebSocket(url);
      }

      const socketUrl = String(url);

      // Hook outgoing send method
      const nativeSend = instance.send;
      instance.send = function (data) {
        forwardFrame('OUTGOING', socketUrl, data);
        return nativeSend.apply(this, arguments);
      };

      // Hook addEventListener for message events
      const nativeAddEventListener = instance.addEventListener;
      instance.addEventListener = function (type, listener, options) {
        if (type === 'message' && typeof listener === 'function') {
          const wrappedListener = function (event) {
            forwardFrame('INCOMING', socketUrl, event.data);
            return listener.apply(this, arguments);
          };
          return nativeAddEventListener.call(this, type, wrappedListener, options);
        }
        return nativeAddEventListener.apply(this, arguments);
      };

      // Hook onmessage property descriptor setter
      let _onmessageHandler = null;
      Object.defineProperty(instance, 'onmessage', {
        get: function () {
          return _onmessageHandler;
        },
        set: function (fn) {
          if (typeof fn === 'function') {
            _onmessageHandler = function (event) {
              forwardFrame('INCOMING', socketUrl, event.data);
              return fn.apply(this, arguments);
            };
          } else {
            _onmessageHandler = null;
          }
          nativeAddEventListener.call(instance, 'message', _onmessageHandler);
        },
        configurable: true,
        enumerable: true
      });

      return instance;
    }

    // Preserve prototype chain and static constants
    TradeFourgeWebSocket.prototype = NativeWebSocket.prototype;
    TradeFourgeWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    TradeFourgeWebSocket.OPEN = NativeWebSocket.OPEN;
    TradeFourgeWebSocket.CLOSING = NativeWebSocket.CLOSING;
    TradeFourgeWebSocket.CLOSED = NativeWebSocket.CLOSED;

    // Override window.WebSocket
    window.WebSocket = TradeFourgeWebSocket;

    console.log('[TradeFourge] Event Pipeline WebSocket Interceptor active.');

  } catch (error) {
    console.error('[TradeFourge] Extension failed to initialize.', error);
  }
})();
