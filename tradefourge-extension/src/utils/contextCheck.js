/**
 * TradeFourge Companion Extension v5.1.2 — Context & Lifecycle Utilities
 * Provides non-throwing validation of extension runtime context and
 * identifies expected Manifest V3 lifecycle events.
 */

/**
 * Verifies if the extension runtime context is active and valid.
 * Safe to call at any time without throwing exceptions.
 */
export function isExtensionContextValid() {
  try {
    if (typeof chrome === 'undefined' || !chrome || !chrome.runtime || !chrome.runtime.id) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Checks whether an error message represents an expected Manifest V3 lifecycle event.
 */
export function isExpectedLifecycleError(error) {
  if (!error) return false;
  const msg = String(error.message || error.reason || error);
  return (
    msg.includes('Extension context invalidated') ||
    msg.includes('Receiving end does not exist') ||
    msg.includes('Could not establish connection') ||
    msg.includes('Port disconnected') ||
    msg.includes('Context destroyed') ||
    msg.includes('Worker suspended') ||
    msg.includes('Script context has been closed')
  );
}
