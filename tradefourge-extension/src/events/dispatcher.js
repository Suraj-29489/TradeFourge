/**
 * TradeFourge Companion Extension — Central Event Dispatcher
 *
 * Generic Pub/Sub event bus. Listeners subscribe by event type or '*' for all events.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeDispatcher = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const listeners = new Map();

  function subscribe(eventType, callback) {
    if (typeof callback !== 'function') return function () {};

    const type = String(eventType || '*').toUpperCase();
    if (!listeners.has(type)) {
      listeners.set(type, new Set());
    }

    listeners.get(type).add(callback);

    // Unsubscribe callback
    return function unsubscribe() {
      if (listeners.has(type)) {
        listeners.get(type).delete(callback);
      }
    };
  }

  function dispatch(event) {
    if (!event || !event.type) return;

    const eventType = String(event.type).toUpperCase();

    // 1. Specific type listeners
    if (listeners.has(eventType)) {
      listeners.get(eventType).forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error('[TradeFourge Dispatcher] Listener error for type ' + eventType, err);
        }
      });
    }

    // 2. Catch-all '*' listeners
    if (listeners.has('*')) {
      listeners.get('*').forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error('[TradeFourge Dispatcher] Wildcard listener error', err);
        }
      });
    }
  }

  function clearAll() {
    listeners.clear();
  }

  return {
    subscribe: subscribe,
    dispatch: dispatch,
    clearAll: clearAll
  };
});
