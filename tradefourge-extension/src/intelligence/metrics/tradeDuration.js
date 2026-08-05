/**
 * TradeFourge Companion Extension — Trade Duration Engine
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeTradeDuration = factory(root.TradeFourgeDerivedEvents);
  }
})(typeof self !== 'undefined' ? self : this, function (DerivedEvents) {

  const positionOpenTimes = new Map();
  const closedDurationsMs = [];

  function formatDuration(ms) {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function trackPosition(position) {
    if (!position || !position.ticket) return null;

    const ticket = position.ticket;
    const now = Date.now();

    if (!positionOpenTimes.has(ticket)) {
      positionOpenTimes.set(ticket, now);
    }

    const openTime = positionOpenTimes.get(ticket);
    const durationMs = Math.max(0, now - openTime);
    const formatted = formatDuration(durationMs);

    if (position.action === 'CLOSE') {
      positionOpenTimes.delete(ticket);
      closedDurationsMs.push(durationMs);
    }

    const Derived = DerivedEvents || (typeof window !== 'undefined' && window.TradeFourgeDerivedEvents);
    if (Derived && typeof Derived.TradeDurationUpdatedEvent === 'function') {
      return Derived.TradeDurationUpdatedEvent({
        ticket: ticket,
        symbol: position.symbol,
        durationMs: durationMs,
        formattedDuration: formatted
      });
    }

    return null;
  }

  function getAverageHoldTimeFormatted() {
    if (closedDurationsMs.length === 0) return '00:00:00';
    const sum = closedDurationsMs.reduce((a, b) => a + b, 0);
    return formatDuration(sum / closedDurationsMs.length);
  }

  return {
    trackPosition: trackPosition,
    formatDuration: formatDuration,
    getAverageHoldTimeFormatted: getAverageHoldTimeFormatted
  };
});
