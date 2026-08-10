/**
 * TradeFourge Companion Extension v5.1.2 — Live Runtime Monitor
 * Monitors realtime order streams, balance shifts, and floating PnL.
 */

import { AdapterManager } from '../adapters/AdapterManager.js';
import { EventBus } from '../eventBus/EventBus.js';
import { Logger } from '../logger/Logger.js';
import { isExtensionContextValid } from '../utils/contextCheck.js';

export class LiveRuntimeMonitor {
  static instance = null;

  static getInstance() {
    if (!LiveRuntimeMonitor.instance) {
      LiveRuntimeMonitor.instance = new LiveRuntimeMonitor();
    }
    return LiveRuntimeMonitor.instance;
  }

  constructor() {
    this.active = false;
  }

  start() {
    if (this.active) return;
    if (!isExtensionContextValid()) return;

    this.active = true;
    Logger.info('LiveRuntimeMonitor', 'Starting live runtime monitoring engine...');

    const adapter = AdapterManager.getInstance().getActiveAdapter();
    if (adapter) {
      adapter.startLiveMonitoring((eventPayload) => {
        if (!isExtensionContextValid()) {
          this.stop();
          return;
        }
        EventBus.getInstance().safeEmit(eventPayload.eventType || 'LIVE_EVENT', eventPayload);
      });
    }
  }

  stop() {
    this.active = false;
    try {
      const adapter = AdapterManager.getInstance().getActiveAdapter();
      if (adapter) {
        adapter.stopLiveMonitoring();
      }
    } catch (err) {}
    Logger.info('LiveRuntimeMonitor', 'Stopped live runtime monitoring engine.');
  }
}
