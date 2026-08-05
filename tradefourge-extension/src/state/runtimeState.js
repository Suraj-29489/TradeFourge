/**
 * TradeFourge Companion Extension — In-Memory Runtime State Manager
 *
 * Maintains live account state, open positions, pending orders, and event counts in memory.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeRuntimeState = factory(root.TradeFourgeDispatcher, root.TradeFourgeEventTypes);
  }
})(typeof self !== 'undefined' ? self : this, function (Dispatcher, EventTypes) {

  const state = {
    account: {
      accountNumber: 'UNKNOWN',
      currency: 'USD',
      balance: 0,
      equity: 0,
      margin: 0,
      freeMargin: 0,
      marginLevel: 0,
      leverage: 100
    },
    openPositions: new Map(),
    pendingOrders: new Map(),
    lastTicks: new Map(),
    lastEvent: null,
    counts: {
      totalCaptured: 0,
      ticks: 0,
      orders: 0,
      deals: 0,
      positions: 0,
      accountUpdates: 0
    }
  };

  function updateStateFromEvent(event) {
    if (!event) return;

    state.counts.totalCaptured++;
    state.lastEvent = event;

    const type = event.type;

    if (type === 'TICK') {
      state.counts.ticks++;
      if (event.instrument) {
        state.lastTicks.set(event.instrument, event);
      }
    } else if (type === 'POSITION') {
      state.counts.positions++;
      if (event.ticket) {
        if (event.action === 'CLOSE') {
          state.openPositions.delete(event.ticket);
        } else {
          state.openPositions.set(event.ticket, event);
        }
      }
    } else if (type === 'ORDER') {
      state.counts.orders++;
      if (event.ticket) {
        if (event.state === 'CANCELLED' || event.state === 'FILLED') {
          state.pendingOrders.delete(event.ticket);
        } else {
          state.pendingOrders.set(event.ticket, event);
        }
      }
    } else if (type === 'DEAL') {
      state.counts.deals++;
    } else if (type === 'ACCOUNT') {
      state.counts.accountUpdates++;
      state.account = {
        accountNumber: event.accountNumber || state.account.accountNumber,
        currency: event.currency || state.account.currency,
        balance: typeof event.balance === 'number' ? event.balance : state.account.balance,
        equity: typeof event.equity === 'number' ? event.equity : state.account.equity,
        margin: typeof event.margin === 'number' ? event.margin : state.account.margin,
        freeMargin: typeof event.freeMargin === 'number' ? event.freeMargin : state.account.freeMargin,
        marginLevel: typeof event.marginLevel === 'number' ? event.marginLevel : state.account.marginLevel,
        leverage: typeof event.leverage === 'number' ? event.leverage : state.account.leverage
      };
    }

    // Dispatch state update to extension bridge / window listeners
    if (typeof window !== 'undefined' && window.postMessage) {
      try {
        window.postMessage({
          source: 'tradefourge-injected',
          type: 'TF_STATE_UPDATE',
          detail: {
            counts: Object.assign({}, state.counts),
            account: Object.assign({}, state.account)
          }
        }, '*');
      } catch (e) {}
    }
  }

  // Subscribe to central dispatcher automatically
  const disp = Dispatcher || (typeof window !== 'undefined' && window.TradeFourgeDispatcher);
  if (disp && typeof disp.subscribe === 'function') {
    disp.subscribe('*', updateStateFromEvent);
  }

  return {
    getState: function () {
      return {
        account: Object.assign({}, state.account),
        openPositionsCount: state.openPositions.size,
        pendingOrdersCount: state.pendingOrders.size,
        counts: Object.assign({}, state.counts),
        lastEvent: state.lastEvent
      };
    },
    getCounts: function () {
      return Object.assign({}, state.counts);
    },
    updateStateFromEvent: updateStateFromEvent
  };
});
