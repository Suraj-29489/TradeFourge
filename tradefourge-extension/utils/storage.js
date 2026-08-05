/**
 * TradeFourge Storage Utility
 * Manages extension state, captured message counts, and persistent preferences.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TradeFourgeStorage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const STORAGE_KEYS = {
    MESSAGES_CAPTURED: 'tf_messages_captured',
    LAST_UPDATED: 'tf_last_updated',
    ACTIVE_TAB_CONNECTED: 'tf_active_tab_connected'
  };

  const isChromeStorageAvailable = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  return {
    KEYS: STORAGE_KEYS,

    /**
     * Get total captured messages count
     * @returns {Promise<number>}
     */
    getMessageCount: function () {
      return new Promise((resolve) => {
        if (isChromeStorageAvailable) {
          chrome.storage.local.get([STORAGE_KEYS.MESSAGES_CAPTURED], (result) => {
            resolve(result[STORAGE_KEYS.MESSAGES_CAPTURED] || 0);
          });
        } else {
          const val = localStorage.getItem(STORAGE_KEYS.MESSAGES_CAPTURED);
          resolve(val ? parseInt(val, 10) : 0);
        }
      });
    },

    /**
     * Increment captured message count atomically
     * @returns {Promise<number>}
     */
    incrementMessageCount: function () {
      return new Promise((resolve) => {
        if (isChromeStorageAvailable) {
          chrome.storage.local.get([STORAGE_KEYS.MESSAGES_CAPTURED], (result) => {
            const current = (result[STORAGE_KEYS.MESSAGES_CAPTURED] || 0) + 1;
            chrome.storage.local.set({
              [STORAGE_KEYS.MESSAGES_CAPTURED]: current,
              [STORAGE_KEYS.LAST_UPDATED]: new Date().toISOString()
            }, () => resolve(current));
          });
        } else {
          const current = (parseInt(localStorage.getItem(STORAGE_KEYS.MESSAGES_CAPTURED) || '0', 10)) + 1;
          localStorage.setItem(STORAGE_KEYS.MESSAGES_CAPTURED, current.toString());
          resolve(current);
        }
      });
    },

    /**
     * Reset counter
     * @returns {Promise<void>}
     */
    resetMessageCount: function () {
      return new Promise((resolve) => {
        if (isChromeStorageAvailable) {
          chrome.storage.local.set({ [STORAGE_KEYS.MESSAGES_CAPTURED]: 0 }, () => resolve());
        } else {
          localStorage.setItem(STORAGE_KEYS.MESSAGES_CAPTURED, '0');
          resolve();
        }
      });
    }
  };
});
