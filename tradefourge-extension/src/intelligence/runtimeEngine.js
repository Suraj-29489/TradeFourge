/**
 * TradeFourge Companion Extension — Runtime Intelligence Engine Core
 *
 * Central brain of the extension. Subscribes to native events, computes derived
 * trading intelligence, updates runtime state, and dispatches derived events.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeRuntimeEngine = factory(
      root.TradeFourgeDispatcher,
      root.TradeFourgeSpreadTracker,
      root.TradeFourgeFloatingPnL,
      root.TradeFourgeEquityTracker,
      root.TradeFourgeDrawdownTracker,
      root.TradeFourgeRiskCalculator,
      root.TradeFourgePortfolioExposure,
      root.TradeFourgeTradeDuration,
      root.TradeFourgePerformanceTracker,
      root.TradeFourgeStatistics,
      root.TradeFourgeRuntimeState
    );
  }
})(typeof self !== 'undefined' ? self : this, function (
  Dispatcher, SpreadTracker, FloatingPnL, EquityTracker, DrawdownTracker,
  RiskCalculator, PortfolioExposure, TradeDuration, PerformanceTracker, Statistics, RuntimeState
) {

  let isInitialized = false;

  function handleNativeEvent(event) {
    if (!event || event.isDerived) return;

    const disp = Dispatcher || (typeof window !== 'undefined' && window.TradeFourgeDispatcher);
    const spread = SpreadTracker || (typeof window !== 'undefined' && window.TradeFourgeSpreadTracker);
    const floatPnL = FloatingPnL || (typeof window !== 'undefined' && window.TradeFourgeFloatingPnL);
    const equityTrk = EquityTracker || (typeof window !== 'undefined' && window.TradeFourgeEquityTracker);
    const ddTrk = DrawdownTracker || (typeof window !== 'undefined' && window.TradeFourgeDrawdownTracker);
    const riskCalc = RiskCalculator || (typeof window !== 'undefined' && window.TradeFourgeRiskCalculator);
    const portExp = PortfolioExposure || (typeof window !== 'undefined' && window.TradeFourgePortfolioExposure);
    const durationTrk = TradeDuration || (typeof window !== 'undefined' && window.TradeFourgeTradeDuration);
    const statsEng = Statistics || (typeof window !== 'undefined' && window.TradeFourgeStatistics);
    const stateMgr = RuntimeState || (typeof window !== 'undefined' && window.TradeFourgeRuntimeState);

    const currentState = stateMgr ? stateMgr.getState() : null;

    try {
      // 1. Tick Events -> Spread, Tick Velocity, Position Floating PnL
      if (event.type === 'TICK') {
        if (spread && typeof spread.processTick === 'function') {
          const spreadEvt = spread.processTick(event);
          if (spreadEvt && disp) disp.dispatch(spreadEvt);
        }

        if (floatPnL && stateMgr && currentState) {
          // Re-evaluate floating PnL for active positions
          const runtimeFullState = stateMgr.getRawState ? stateMgr.getRawState() : null;
          if (runtimeFullState && runtimeFullState.openPositions) {
            for (const pos of runtimeFullState.openPositions.values()) {
              if (pos.symbol === event.instrument) {
                const floatEvt = floatPnL.updatePositionTick(pos, event);
                if (floatEvt && disp) disp.dispatch(floatEvt);
              }
            }
          }
        }
      }

      // 2. Position Events -> Duration, Risk, Portfolio Exposure, Closing Stats
      else if (event.type === 'POSITION') {
        if (durationTrk && typeof durationTrk.trackPosition === 'function') {
          const durEvt = durationTrk.trackPosition(event);
          if (durEvt && disp) disp.dispatch(durEvt);
        }

        if (event.action === 'CLOSE') {
          if (floatPnL && typeof floatPnL.removePosition === 'function') {
            floatPnL.removePosition(event.ticket);
          }
          if (statsEng && typeof statsEng.update === 'function') {
            const statsEvt = statsEng.update(event.profit);
            if (statsEvt && disp) disp.dispatch(statsEvt);
          }
        }

        if (riskCalc && stateMgr && currentState) {
          const runtimeFullState = stateMgr.getRawState ? stateMgr.getRawState() : null;
          const openMap = runtimeFullState ? runtimeFullState.openPositions : null;
          const riskEvt = riskCalc.calculateRisk(openMap, currentState.account);
          if (riskEvt && disp) disp.dispatch(riskEvt);
        }

        if (portExp && stateMgr) {
          const runtimeFullState = stateMgr.getRawState ? stateMgr.getRawState() : null;
          const openMap = runtimeFullState ? runtimeFullState.openPositions : null;
          const portEvt = portExp.calculateExposure(openMap);
          if (portEvt && disp) disp.dispatch(portEvt);
        }
      }

      // 3. Account Events -> Equity High/Low, Drawdown calculations
      else if (event.type === 'ACCOUNT') {
        if (equityTrk && typeof equityTrk.processAccountUpdate === 'function') {
          const eqEvts = equityTrk.processAccountUpdate(event);
          if (Array.isArray(eqEvts) && disp) {
            eqEvts.forEach(evt => disp.dispatch(evt));
          }
        }

        if (ddTrk && typeof ddTrk.update === 'function') {
          const ddEvt = ddTrk.update(event.equity, event.balance);
          if (ddEvt && disp) disp.dispatch(ddEvt);
        }
      }

    } catch (err) {
      // Runtime intelligence errors must never block native events or page logic
    }
  }

  function init() {
    if (isInitialized) return;
    const disp = Dispatcher || (typeof window !== 'undefined' && window.TradeFourgeDispatcher);
    if (disp && typeof disp.subscribe === 'function') {
      disp.subscribe('*', handleNativeEvent);
      isInitialized = true;
      console.log('[TradeFourge] Runtime Intelligence Engine initialized.');
    }
  }

  // Auto-initialize if dispatcher is available
  init();

  return {
    init: init,
    handleNativeEvent: handleNativeEvent
  };
});
