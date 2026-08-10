/**
 * TradeFourge Companion Extension v5.5.3 — Outbound Message Queue
 * Prevents message loss during temporary disconnects by buffering events
 * and replaying them when the connection is restored.
 */

import { Logger } from '../logger/Logger.js';

export class OutboundMessageQueue {
  static instance = null;

  static getInstance() {
    if (!OutboundMessageQueue.instance) {
      OutboundMessageQueue.instance = new OutboundMessageQueue();
    }
    return OutboundMessageQueue.instance;
  }

  constructor(maxCapacity = 100) {
    this.queue = [];
    this.maxCapacity = maxCapacity;
    this.isReplaying = false;
  }

  enqueue(message) {
    if (this.queue.length >= this.maxCapacity) {
      const dropped = this.queue.shift();
      Logger.warn('Queue', `Queue capacity (${this.maxCapacity}) exceeded. Dropped oldest message: ${dropped?.type}`);
    }

    const item = {
      message,
      enqueuedAt: Date.now(),
      attempts: 0,
    };

    this.queue.push(item);
    Logger.info('Queue', `Enqueued message: ${message.type} (Queue size: ${this.queue.length})`);
    return item;
  }

  size() {
    return this.queue.length;
  }

  isEmpty() {
    return this.queue.length === 0;
  }

  clear() {
    const count = this.queue.length;
    this.queue = [];
    Logger.info('Queue', `Cleared ${count} items from outbound queue.`);
  }

  async replay(dispatchFn) {
    if (this.isReplaying || this.queue.length === 0) return;
    this.isReplaying = true;

    Logger.info('Queue', `Replaying ${this.queue.length} queued outbound message(s)...`);

    const itemsToReplay = [...this.queue];
    this.queue = [];

    for (const item of itemsToReplay) {
      try {
        item.attempts += 1;
        await dispatchFn(item.message);
        Logger.success('Queue', `Successfully replayed message: ${item.message.type}`);
      } catch (err) {
        Logger.error('Queue', `Failed to replay message ${item.message.type} (Attempt ${item.attempts}):`, err);
        // Put back if attempt limit not exceeded
        if (item.attempts < 3) {
          this.queue.push(item);
        }
      }
    }

    this.isReplaying = false;
  }
}
