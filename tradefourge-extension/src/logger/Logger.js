/**
 * TradeFourge Companion Extension v3.0 — Logger Module
 * Structured logger maintaining in-memory runtime history and severity levels.
 */

export class Logger {
  static logs = [];
  static maxLogs = 100;

  static log(severity, moduleName, message, details = null) {
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      severity,
      event: `[${moduleName}]`,
      description: message,
      details,
    };

    Logger.logs.unshift(entry);
    if (Logger.logs.length > Logger.maxLogs) {
      Logger.logs.pop();
    }

    const prefix = `[TradeFourge Companion][${moduleName}]`;
    switch (severity) {
      case 'ERROR':
        console.error(prefix, message, details || '');
        break;
      case 'WARN':
      case 'WARNING':
        console.warn(prefix, message, details || '');
        break;
      case 'SUCCESS':
        console.log(`%c${prefix} ${message}`, 'color: #10B981; font-weight: bold;', details || '');
        break;
      case 'DEBUG':
        console.debug(prefix, message, details || '');
        break;
      default:
        console.log(prefix, message, details || '');
        break;
    }

    return entry;
  }

  static info(moduleName, message, details) {
    return Logger.log('INFO', moduleName, message, details);
  }

  static success(moduleName, message, details) {
    return Logger.log('SUCCESS', moduleName, message, details);
  }

  static warn(moduleName, message, details) {
    return Logger.log('WARNING', moduleName, message, details);
  }

  static error(moduleName, message, details) {
    return Logger.log('ERROR', moduleName, message, details);
  }

  static debug(moduleName, message, details) {
    return Logger.log('DEBUG', moduleName, message, details);
  }

  static getLogs() {
    return [...Logger.logs];
  }
}
