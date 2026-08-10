/**
 * TradeFourge Companion Extension v5.1.1 — Structured Logger Module
 * Supports DEBUG_EXTENSION toggle and suppresses expected Manifest V3 lifecycle events.
 */

import { isExpectedLifecycleError } from '../utils/contextCheck.js';

export class Logger {
  static logs = [];
  static maxLogs = 200;
  static DEBUG_EXTENSION = false; // Toggle to enable verbose extension tracing

  static setDebugMode(enabled) {
    Logger.DEBUG_EXTENSION = !!enabled;
    console.log(`[TradeFourge Companion] Debug mode set to: ${Logger.DEBUG_EXTENSION}`);
  }

  static formatLog(severity, moduleName, message, metadata = {}) {
    const errorObj = metadata.error || metadata.details;
    if (isExpectedLifecycleError(errorObj)) {
      // Expected Manifest V3 lifecycle disconnect — suppress console spam unless DEBUG_EXTENSION is on
      if (Logger.DEBUG_EXTENSION) {
        console.debug(`[TradeFourge][${moduleName}] Expected lifecycle event: ${message}`);
      }
      return null;
    }

    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      severity,
      module: moduleName,
      tag: `[${moduleName}]`,
      message,
      retryCount: metadata.retryCount ?? 0,
      tabId: metadata.tabId ?? null,
      url: metadata.url ?? (typeof window !== 'undefined' ? window.location?.href : 'background'),
      recoveryAction: metadata.recoveryAction ?? null,
      details: metadata.details ?? null,
      errorStack: metadata.error ? (metadata.error.stack || String(metadata.error)) : null,
    };

    Logger.logs.unshift(entry);
    if (Logger.logs.length > Logger.maxLogs) {
      Logger.logs.pop();
    }

    const prefix = `[TradeFourge][${moduleName}]`;
    const recoveryStr = entry.recoveryAction ? ` | Action: ${entry.recoveryAction}` : '';

    switch (severity) {
      case 'ERROR':
        console.error(`${prefix} ❌ ${message}${recoveryStr}`, entry.details || entry.errorStack || '');
        break;
      case 'WARN':
      case 'WARNING':
        console.warn(`${prefix} ⚠️ ${message}${recoveryStr}`, entry.details || '');
        break;
      case 'SUCCESS':
        console.log(`%c${prefix} ✅ ${message}${recoveryStr}`, 'color: #10B981; font-weight: bold;', entry.details || '');
        break;
      case 'DEBUG':
        if (Logger.DEBUG_EXTENSION) {
          console.debug(`${prefix} 🔍 ${message}`, entry.details || '');
        }
        break;
      default:
        console.log(`${prefix} ℹ️ ${message}`, entry.details || '');
        break;
    }

    return entry;
  }

  static info(moduleName, message, metadata) {
    return Logger.formatLog('INFO', moduleName, message, metadata);
  }

  static success(moduleName, message, metadata) {
    return Logger.formatLog('SUCCESS', moduleName, message, metadata);
  }

  static warn(moduleName, message, metadata) {
    return Logger.formatLog('WARN', moduleName, message, metadata);
  }

  static error(moduleName, message, metadata) {
    return Logger.formatLog('ERROR', moduleName, message, metadata);
  }

  static debug(moduleName, message, metadata) {
    return Logger.formatLog('DEBUG', moduleName, message, metadata);
  }

  static getLogs() {
    return [...Logger.logs];
  }

  static clearLogs() {
    Logger.logs = [];
  }
}
