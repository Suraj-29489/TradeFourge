/**
 * TradeFourge Extension Host Validator Utility
 * Strictly checks hostnames against supported broker web terminals.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeValidator = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  /**
   * Evaluates if a given URL or hostname is a supported Exness page.
   * Target domains:
   * https://terminal.exness.*
   * https://my.exness.*
   *
   * @param {string} urlOrHostname
   * @returns {boolean}
   */
  function isSupportedWebsite(urlOrHostname) {
    if (!urlOrHostname) return false;

    let hostname = urlOrHostname;
    try {
      if (urlOrHostname.includes('://')) {
        const parsed = new URL(urlOrHostname);
        hostname = parsed.hostname;
      }
    } catch (e) {
      return false;
    }

    hostname = hostname.toLowerCase();

    // Regex match: must start with terminal.exness. or my.exness.
    const isExnessTerminal = /^terminal\.exness\.[a-z0-9.-]+$/i.test(hostname);
    const isExnessMy = /^my\.exness\.[a-z0-9.-]+$/i.test(hostname);

    return isExnessTerminal || isExnessMy;
  }

  return {
    isSupportedWebsite: isSupportedWebsite
  };
});
