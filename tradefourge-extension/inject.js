/**
 * TradeFourge Extension — Page Context Injected Script (Main World)
 *
 * Intercepts WebSocket communication safely without interfering with page operations,
 * modifying payloads, or altering packet timing.
 */

(function () {
  'use strict';

  // Double-initialization guard
  if (window.__TRADEFOURGE_INJECTED__) {
    return;
  }
  window.__TRADEFOURGE_INJECTED__ = true;

  try {
    // --------------------------------------------------------
    // 1. WebSocket Interceptor Core (Active for v1)
    // --------------------------------------------------------
    const NativeWebSocket = window.WebSocket;

    if (!NativeWebSocket) {
      console.warn('[TradeFourge Extension] Native WebSocket API not available in page context.');
      return;
    }

    function calculatePayloadSize(payload) {
      if (!payload) return 0;
      if (typeof payload === 'string') {
        return new TextEncoder().encode(payload).length;
      }
      if (payload instanceof ArrayBuffer) {
        return payload.byteLength;
      }
      if (ArrayBuffer.isView(payload)) {
        return payload.byteLength;
      }
      if (typeof Blob !== 'undefined' && payload instanceof Blob) {
        return payload.size;
      }
      return 0;
    }

    function safeLog(direction, socketUrl, payload) {
      try {
        const payloadSize = calculatePayloadSize(payload);
        const timestamp = new Date().toISOString();
        const title = direction === 'INCOMING' ? 'Incoming WebSocket Message' : 'Outgoing WebSocket Message';

        // Formatted log as required by TradeFourge Extension v1 spec
        console.log(
          `[TradeFourge Extension]\n\n${title}\n\n` +
          `Timestamp: ${timestamp}\n` +
          `Socket URL: ${socketUrl}\n` +
          `Direction: ${direction}\n` +
          `Payload Size: ${payloadSize} bytes\n` +
          `Raw Payload:`
        );
        console.log(payload);

        // Notify content.js bridge via window.postMessage
        window.postMessage({
          source: 'tradefourge-injected',
          type: 'WS_MESSAGE_CAPTURED',
          detail: {
            direction: direction,
            url: socketUrl,
            size: payloadSize,
            timestamp: timestamp
          }
        }, '*');
      } catch (logErr) {
        // Interception logging must NEVER crash webpage functionality
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
        safeLog('OUTGOING', socketUrl, data);
        return nativeSend.apply(this, arguments);
      };

      // Hook addEventListener for message events
      const nativeAddEventListener = instance.addEventListener;
      instance.addEventListener = function (type, listener, options) {
        if (type === 'message' && typeof listener === 'function') {
          const wrappedListener = function (event) {
            safeLog('INCOMING', socketUrl, event.data);
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
              safeLog('INCOMING', socketUrl, event.data);
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

    // Preserve original prototype chain and static constants
    TradeFourgeWebSocket.prototype = NativeWebSocket.prototype;
    TradeFourgeWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    TradeFourgeWebSocket.OPEN = NativeWebSocket.OPEN;
    TradeFourgeWebSocket.CLOSING = NativeWebSocket.CLOSING;
    TradeFourgeWebSocket.CLOSED = NativeWebSocket.CLOSED;

    // Replace native window.WebSocket with wrapped interceptor
    window.WebSocket = TradeFourgeWebSocket;


    // --------------------------------------------------------
    // 2. Fetch Interceptor Core (Implemented but disabled for v1)
    // --------------------------------------------------------
    /*
    const nativeFetch = window.fetch;
    window.fetch = async function (input, init) {
      // Future phase HTTP interception logic
      return nativeFetch.apply(this, arguments);
    };
    */

    // --------------------------------------------------------
    // 3. XMLHttpRequest Interceptor Core (Implemented but disabled for v1)
    // --------------------------------------------------------
    /*
    const NativeXHR = window.XMLHttpRequest;
    function TradeFourgeXHR() {
      const xhr = new NativeXHR();
      // Future phase XHR interception logic
      return xhr;
    }
    window.XMLHttpRequest = TradeFourgeXHR;
    */

    console.log('[TradeFourge Extension] WebSocket Interceptor loaded and active.');

  } catch (error) {
    console.error('[TradeFourge Extension] TradeFourge Extension failed to initialize.', error);
  }
})();
