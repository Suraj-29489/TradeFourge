/**
 * TradeFourge Companion Extension v3.0 — Live Runtime Monitor
 * Monitors realtime order streams, balance shifts, and floating PnL.
 */

import { AdapterManager } from '../adapters/AdapterManager.js';
import { EventBus } from '../eventBus/EventBus.js';
import { Logger } from '../logger/Logger.js';

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
    this.active = true;
    Logger.info('LiveRuntimeMonitor', 'Starting live runtime monitoring engine...');

    const adapter = AdapterManager.getInstance().getActiveAdapter();
    adapter.startLiveMonitoring((eventPayload) => {
      EventBus.getInstance().emit(eventPayload.eventType || 'LIVE_EVENT', eventPayload);
    });
  }

  stop() {
    this.active = false;
    const adapter = AdapterManager.getInstance().getActiveAdapter();
    adapter.stopLiveMonitoring();
    Logger.info('LiveRuntimeMonitor', 'Stopped live runtime monitoring engine.');
  }
}
