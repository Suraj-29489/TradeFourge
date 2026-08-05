/**
 * TradeFourge Companion Extension — Derived Events
 *
 * Defines event models produced internally by the Runtime Intelligence Engine.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeDerivedEvents = factory(root.TradeFourgeBaseEvent);
  }
})(typeof self !== 'undefined' ? self : this, function (BaseEvent) {

  function createDerivedEvent(type, data) {
    const event = BaseEvent ? new BaseEvent(type, null, 'tradefourge://runtime-engine') : {
      id: 'derived_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      type: type,
      timestamp: new Date().toISOString(),
      broker: 'TradeFourge Intelligence'
    };
    return Object.assign(event, data, { isDerived: true });
  }

  return {
    SpreadChangedEvent: function (data) { return createDerivedEvent('DERIVED_SPREAD_CHANGED', data); },
    DrawdownChangedEvent: function (data) { return createDerivedEvent('DERIVED_DRAWDOWN_CHANGED', data); },
    ExposureChangedEvent: function (data) { return createDerivedEvent('DERIVED_EXPOSURE_CHANGED', data); },
    TradeDurationUpdatedEvent: function (data) { return createDerivedEvent('DERIVED_DURATION_UPDATED', data); },
    FloatingProfitChangedEvent: function (data) { return createDerivedEvent('DERIVED_FLOATING_PROFIT_CHANGED', data); },
    MarginChangedEvent: function (data) { return createDerivedEvent('DERIVED_MARGIN_CHANGED', data); },
    WinRateUpdatedEvent: function (data) { return createDerivedEvent('DERIVED_WINRATE_UPDATED', data); },
    StatisticsUpdatedEvent: function (data) { return createDerivedEvent('DERIVED_STATISTICS_UPDATED', data); },
    EquityHighEvent: function (data) { return createDerivedEvent('DERIVED_EQUITY_HIGH', data); },
    EquityLowEvent: function (data) { return createDerivedEvent('DERIVED_EQUITY_LOW', data); },
    PortfolioUpdatedEvent: function (data) { return createDerivedEvent('DERIVED_PORTFOLIO_UPDATED', data); }
  };
});
