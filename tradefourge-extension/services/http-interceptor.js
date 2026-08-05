/**
 * TradeFourge Extension HTTP Interceptor Service
 * Prepared for future phases (fetch & XHR hooks).
 * DISABLED FOR V1 as per specification.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeHTTPInterceptor = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  let isFetchHooked = false;
  let isXHRHooked = false;

  /**
   * Hook window.fetch (Disabled for v1)
   */
  function initFetchHook() {
    /* FUTURE PHASE ENABLE:
    if (isFetchHooked || typeof window === 'undefined' || !window.fetch) return;
    const nativeFetch = window.fetch;
    window.fetch = async function (resource, config) {
      // Log / inspect outgoing request
      const response = await nativeFetch.apply(this, arguments);
      // Log / inspect incoming response
      return response;
    };
    isFetchHooked = true;
    */
    console.log('[TradeFourge Extension] HTTP Fetch Interceptor is disabled for v1');
  }

  /**
   * Hook XMLHttpRequest (Disabled for v1)
   */
  function initXHRHook() {
    /* FUTURE PHASE ENABLE:
    if (isXHRHooked || typeof window === 'undefined' || !window.XMLHttpRequest) return;
    const NativeXHR = window.XMLHttpRequest;
    function WrappedXHR() {
      const xhr = new NativeXHR();
      // Attach listeners to xhr.open, xhr.send, xhr.onreadystatechange
      return xhr;
    }
    window.XMLHttpRequest = WrappedXHR;
    isXHRHooked = true;
    */
    console.log('[TradeFourge Extension] HTTP XHR Interceptor is disabled for v1');
  }

  return {
    initFetchHook: initFetchHook,
    initXHRHook: initXHRHook,
    isFetchHooked: function () { return isFetchHooked; },
    isXHRHooked: function () { return isXHRHooked; }
  };
});
