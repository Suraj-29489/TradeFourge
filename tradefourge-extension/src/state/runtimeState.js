/**
 * TradeFourge Companion Extension — In-Memory Runtime State Manager
 *
 * Maintains live account state, open positions, pending orders, event counts,
 * and derived intelligence metrics (drawdown, floating PnL, win rate, current spread).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeRuntimeState = factory(root.TradeFourgeDispatcher);
  }
})(typeof self !== 'undefined' ? self : this, function (Dispatcher) {

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
    intelligence: {
      floatingPnL: 0,
      drawdownPercent: 0,
      drawdownAmount: 0,
      peakEquity: 0,
      currentSpread: 0,
      winRate: 0,
      exposurePercent: 0,
      totalLots: 0
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

    if (!event.isDerived) {
      state.counts.totalCaptured++;
      state.lastEvent = event;
    }

    const type = event.type;

    if (type === 'TICK') {
      state.counts.ticks++;
      if (event.instrument) {
        state.lastTicks.set(event.instrument, event);
        state.intelligence.currentSpread = event.spread || state.intelligence.currentSpread;
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
      state.intelligence.floatingPnL = parseFloat((state.account.equity - state.account.balance).toFixed(2));
    }

    // Derived Event updates
    else if (type === 'DERIVED_SPREAD_CHANGED') {
      state.intelligence.currentSpread = event.spread || state.intelligence.currentSpread;
    } else if (type === 'DERIVED_DRAWDOWN_CHANGED') {
      state.intelligence.drawdownPercent = event.drawdownPercent || 0;
      state.intelligence.drawdownAmount = event.drawdownAmount || 0;
      state.intelligence.peakEquity = event.peakEquity || state.intelligence.peakEquity;
    } else if (type === 'DERIVED_EXPOSURE_CHANGED') {
      state.intelligence.exposurePercent = event.exposurePercent || 0;
      state.intelligence.totalLots = event.totalLots || 0;
    } else if (type === 'DERIVED_FLOATING_PROFIT_CHANGED') {
      // Re-calculate aggregate floating PnL if needed
    } else if (type === 'DERIVED_WINRATE_UPDATED') {
      state.intelligence.winRate = event.winRate || 0;
    }

    // Dispatch live state metrics bridge to window.postMessage for content script / popup
    if (typeof window !== 'undefined' && window.postMessage) {
      try {
        window.postMessage({
          source: 'tradefourge-injected',
          type: 'TF_STATE_UPDATE',
          detail: {
            counts: Object.assign({}, state.counts),
            account: Object.assign({}, state.account),
            intelligence: Object.assign({}, state.intelligence),
            openPositionsCount: state.openPositions.size
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
        intelligence: Object.assign({}, state.intelligence),
        openPositionsCount: state.openPositions.size,
        pendingOrdersCount: state.pendingOrders.size,
        counts: Object.assign({}, state.counts),
        lastEvent: state.lastEvent
      };
    },
    getRawState: function () {
      return state;
    },
    getCounts: function () {
      return Object.assign({}, state.counts);
    },
    updateStateFromEvent: updateStateFromEvent
  };
});
