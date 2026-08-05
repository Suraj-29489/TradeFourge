/**
 * TradeFourge Companion Extension — Account Parser
 *
 * Parses account balance and equity updates and converts them to AccountEvent instances.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeAccountParser = factory(root.TradeFourgeAccountEvent);
  }
})(typeof self !== 'undefined' ? self : this, function (AccountEvent) {

  function isAccountPayload(data) {
    if (!data || typeof data !== 'object') return false;

    if (Array.isArray(data)) {
      const eventName = data[0];
      if (typeof eventName === 'string' && (eventName.includes('account') || eventName.includes('balance') || eventName.includes('equity'))) return true;
      if (data[1] && typeof data[1] === 'object') return isAccountPayload(data[1]);
      return false;
    }

    const hasAccountKey = !!(data.account || data.accountNumber || data.login || data.type === 'account');
    const hasBalanceOrEquity = (typeof data.balance === 'number' || typeof data.equity === 'number');

    return (hasAccountKey || hasBalanceOrEquity) && !data.ticket && !data.symbol;
  }

  function parse(parsedJson, rawPayload, socketUrl) {
    if (!isAccountPayload(parsedJson)) return null;

    let targetObj = parsedJson;
    if (Array.isArray(parsedJson)) {
      targetObj = typeof parsedJson[1] === 'object' ? parsedJson[1] : parsedJson[0];
    }

    const accountNumber = targetObj.accountNumber || targetObj.account || targetObj.login || 'UNKNOWN';
    const currency = targetObj.currency || targetObj.ccy || 'USD';
    const balance = typeof targetObj.balance === 'number' ? targetObj.balance : 0;
    const equity = typeof targetObj.equity === 'number' ? targetObj.equity : balance;
    const margin = typeof targetObj.margin === 'number' ? targetObj.margin : 0;
    const freeMargin = typeof targetObj.freeMargin === 'number' ? targetObj.freeMargin : Math.max(0, equity - margin);
    const marginLevel = typeof targetObj.marginLevel === 'number' ? targetObj.marginLevel : (margin > 0 ? (equity / margin) * 100 : 0);
    const leverage = typeof targetObj.leverage === 'number' ? targetObj.leverage : 100;

    const EventConstructor = AccountEvent || (window && window.TradeFourgeAccountEvent);
    if (!EventConstructor) return null;

    return new EventConstructor({
      accountNumber: accountNumber,
      currency: currency,
      balance: balance,
      equity: equity,
      margin: margin,
      freeMargin: freeMargin,
      marginLevel: marginLevel,
      leverage: leverage
    }, rawPayload, socketUrl);
  }

  return {
    name: 'AccountParser',
    isAccountPayload: isAccountPayload,
    parse: parse
  };
});
