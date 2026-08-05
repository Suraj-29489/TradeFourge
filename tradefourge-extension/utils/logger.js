/**
 * TradeFourge Extension — Pretty Structured Console Logger
 * Subscribes to the central Event Dispatcher to log beautiful structured event outputs.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeLogger = factory(root.TradeFourgeDispatcher);
  }
})(typeof self !== 'undefined' ? self : this, function (Dispatcher) {
  const PREFIX = '[TradeFourge]';

  function logEvent(event) {
    if (!event || !event.type) return;

    try {
      switch (event.type) {
        case 'TICK':
          console.groupCollapsed(
            `%c${PREFIX}%c Tick Event: %c${event.instrument}%c (Bid: ${event.bid} | Ask: ${event.ask})`,
            'color: #00e5ff; font-weight: bold;',
            'color: #ffffff; font-weight: bold;',
            'color: #76ff03; font-weight: bold;',
            'color: #9ca3af;'
          );
          console.log(
            `${PREFIX}\n\n` +
            `Tick Event\n` +
            `Instrument : ${event.instrument}\n` +
            `Bid        : ${event.bid}\n` +
            `Ask        : ${event.ask}\n` +
            `Spread     : ${event.spread}\n` +
            `Timestamp  : ${event.timestamp}\n` +
            `------------------------`
          );
          console.groupEnd();
          break;

        case 'POSITION':
          console.group(
            `%c${PREFIX}%c Position ${event.action}: %cTicket #${event.ticket}%c (${event.symbol} ${event.direction} ${event.volume} lots)`,
            'color: #00e5ff; font-weight: bold;',
            'color: #ffb74d; font-weight: bold;',
            'color: #ffffff; font-weight: bold;',
            'color: #9ca3af;'
          );
          console.log(
            `${PREFIX}\n\n` +
            `Position ${event.action}\n` +
            `Ticket     : ${event.ticket}\n` +
            `Symbol     : ${event.symbol}\n` +
            `Direction  : ${event.direction}\n` +
            `Volume     : ${event.volume} lots\n` +
            `Entry Price: ${event.entryPrice}\n` +
            `SL         : ${event.sl}\n` +
            `TP         : ${event.tp}\n` +
            `Profit     : ${event.profit}\n` +
            `Timestamp  : ${event.timestamp}\n` +
            `------------------------`
          );
          console.groupEnd();
          break;

        case 'ORDER':
          console.group(
            `%c${PREFIX}%c Order ${event.state}: %cTicket #${event.ticket}%c (${event.symbol} ${event.orderType})`,
            'color: #00e5ff; font-weight: bold;',
            'color: #ba68c8; font-weight: bold;',
            'color: #ffffff; font-weight: bold;',
            'color: #9ca3af;'
          );
          console.log(
            `${PREFIX}\n\n` +
            `Order ${event.state}\n` +
            `Ticket     : ${event.ticket}\n` +
            `Symbol     : ${event.symbol}\n` +
            `Order Type : ${event.orderType}\n` +
            `Volume     : ${event.volume}\n` +
            `Price      : ${event.price}\n` +
            `SL         : ${event.sl}\n` +
            `TP         : ${event.tp}\n` +
            `Timestamp  : ${event.timestamp}\n` +
            `------------------------`
          );
          console.groupEnd();
          break;

        case 'DEAL':
          console.group(
            `%c${PREFIX}%c Deal Execution: %cTicket #${event.dealTicket}%c (${event.symbol} Profit: ${event.profit})`,
            'color: #00e5ff; font-weight: bold;',
            'color: #81c784; font-weight: bold;',
            'color: #ffffff; font-weight: bold;',
            'color: #9ca3af;'
          );
          console.log(
            `${PREFIX}\n\n` +
            `Deal Execution\n` +
            `Deal Ticket: ${event.dealTicket}\n` +
            `Pos Ticket : ${event.positionTicket}\n` +
            `Symbol     : ${event.symbol}\n` +
            `Direction  : ${event.direction}\n` +
            `Volume     : ${event.volume}\n` +
            `Price      : ${event.price}\n` +
            `Profit     : ${event.profit}\n` +
            `Commission : ${event.commission}\n` +
            `Swap       : ${event.swap}\n` +
            `Timestamp  : ${event.timestamp}\n` +
            `------------------------`
          );
          console.groupEnd();
          break;

        case 'ACCOUNT':
          console.group(
            `%c${PREFIX}%c Account Update: %cAccount #${event.accountNumber}%c (Balance: ${event.balance} ${event.currency})`,
            'color: #00e5ff; font-weight: bold;',
            'color: #64b5f6; font-weight: bold;',
            'color: #ffffff; font-weight: bold;',
            'color: #9ca3af;'
          );
          console.log(
            `${PREFIX}\n\n` +
            `Account Update\n` +
            `Account #  : ${event.accountNumber}\n` +
            `Currency   : ${event.currency}\n` +
            `Balance    : ${event.balance}\n` +
            `Equity     : ${event.equity}\n` +
            `Margin     : ${event.margin}\n` +
            `Free Margin: ${event.freeMargin}\n` +
            `Margin Lvl : ${event.marginLevel}%\n` +
            `Timestamp  : ${event.timestamp}\n` +
            `------------------------`
          );
          console.groupEnd();
          break;

        default:
          // RAW_UNKNOWN or unrecognized payload
          break;
      }
    } catch (e) {
      // Logger errors must never break execution
    }
  }

  // Subscribe logger to central dispatcher
  const disp = Dispatcher || (typeof window !== 'undefined' && window.TradeFourgeDispatcher);
  if (disp && typeof disp.subscribe === 'function') {
    disp.subscribe('*', logEvent);
  }

  return {
    logEvent: logEvent,
    info: function (msg, ...args) { console.log(`${PREFIX} [INFO] ${msg}`, ...args); },
    warn: function (msg, ...args) { console.warn(`${PREFIX} [WARN] ${msg}`, ...args); },
    error: function (msg, ...args) { console.error(`${PREFIX} [ERROR] ${msg}`, ...args); }
  };
});
