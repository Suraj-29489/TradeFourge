/**
 * TradeFourge Companion v5.5.3 — Communication Bridge
 * Manages cross-tab Manifest V3 messaging via chrome.runtime.sendMessage(extensionId, msg).
 * Integrates context invalidation recovery, outbound message queue, connection state machine,
 * and automatic listener cleanup.
 */

import {
  TF_MESSAGE_TYPES,
  TF_SOURCE_EXTENSION,
  TF_SOURCE_WEB,
  TFMessageEnvelope,
  TFMessageError,
  TFMessageType,
} from "./protocol";
import { WebConnectionStateMachine } from "./state-machine";

type EventCallback = (message: TFMessageEnvelope) => void;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
}

interface QueuedMessage {
  type: TFMessageType;
  payload?: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  enqueuedAt: number;
}

const TAG = "[TradeFourge Web]";
const VERSION = "5.5.3";

export class CompanionBridge {
  private static instance: CompanionBridge;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private outboundQueue: QueuedMessage[] = [];
  private eventSubscribers: Map<string, Set<EventCallback>> = new Map();
  private isInitialized = false;
  private extensionId: string | null = null;
  private browserName: "Chrome" | "Edge" | "Firefox" | "Brave" | "Unknown" = "Unknown";
  private stateMachine = WebConnectionStateMachine.getInstance();

  public static getInstance(): CompanionBridge {
    if (!CompanionBridge.instance) {
      CompanionBridge.instance = new CompanionBridge();
    }
    return CompanionBridge.instance;
  }

  private constructor() {
    this.detectBrowser();
    if (typeof window !== "undefined") {
      this.discoverExtensionId();
      this.initWindowListener();
    }
  }

  private detectBrowser() {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const ua = navigator.userAgent;
    if (ua.includes("Edg/")) {
      this.browserName = "Edge";
    } else if (ua.includes("Brave")) {
      this.browserName = "Brave";
    } else if (ua.includes("Firefox/")) {
      this.browserName = "Firefox";
    } else if (ua.includes("Chrome/")) {
      this.browserName = "Chrome";
    } else {
      this.browserName = "Unknown";
    }
  }

  /**
   * Phase 3: Check if extension context is active and valid.
   */
  public isExtensionAlive(): boolean {
    try {
      if (typeof window === "undefined") return false;
      const hasRuntime = !!(window as any).chrome?.runtime?.sendMessage;
      const hasId = !!this.refreshExtensionId();
      return hasRuntime && hasId;
    } catch (err) {
      return false;
    }
  }

  private discoverExtensionId() {
    if (typeof document === "undefined") return;

    const id = document.documentElement.getAttribute("data-tradefourge-extension-id");
    if (id) {
      this.extensionId = id;
      this.stateMachine.transitionTo("Injected", { extensionId: id });
      console.log(`${TAG} Extension ID discovered from DOM: ${id}`);
      return;
    }

    const observer = new MutationObserver(() => {
      const injectedId = document.documentElement.getAttribute("data-tradefourge-extension-id");
      if (injectedId) {
        this.extensionId = injectedId;
        this.stateMachine.transitionTo("Injected", { extensionId: injectedId });
        console.log(`${TAG} Extension ID discovered via MutationObserver: ${injectedId}`);
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-tradefourge-extension-id"],
    });
  }

  private refreshExtensionId(): string | null {
    if (this.extensionId) return this.extensionId;
    if (typeof document === "undefined") return null;
    const id = document.documentElement.getAttribute("data-tradefourge-extension-id");
    if (id) {
      this.extensionId = id;
    }
    return this.extensionId;
  }

  private initWindowListener() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    window.addEventListener("message", (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      const data = event.data as TFMessageEnvelope;
      if (data.source !== TF_SOURCE_EXTENSION) return;

      // Resolve pending request
      if (data.requestId && this.pendingRequests.has(data.requestId)) {
        const pending = this.pendingRequests.get(data.requestId)!;
        clearTimeout(pending.timer);
        this.pendingRequests.delete(data.requestId);

        if (data.type === TF_MESSAGE_TYPES.ERROR || data.error) {
          pending.reject(data.error);
        } else {
          pending.resolve(data.payload ?? data);
        }
      }

      // Notify typed subscribers
      const subscribers = this.eventSubscribers.get(data.type);
      if (subscribers && subscribers.size > 0) {
        subscribers.forEach((cb) => {
          try {
            cb(data);
          } catch (err) {
            console.error(`${TAG} Subscriber callback error for ${data.type}:`, err);
          }
        });
      }

      // Wildcard subscribers
      const wildcardSubs = this.eventSubscribers.get("*");
      if (wildcardSubs && wildcardSubs.size > 0) {
        wildcardSubs.forEach((cb) => {
          try {
            cb(data);
          } catch (err) {
            console.error(`${TAG} Wildcard subscriber error:`, err);
          }
        });
      }
    });
  }

  /**
   * Reconnect routine to restore connection state after context invalidation.
   */
  public async reconnect(): Promise<boolean> {
    this.stateMachine.transitionTo("Recovering", { action: "Reconnect initiated" });
    const extId = this.refreshExtensionId();
    if (!extId) {
      this.stateMachine.transitionTo("Error", { reason: "No Extension ID detected" });
      return false;
    }

    try {
      const pong = await this.send("PING", undefined, 3000);
      if (pong) {
        this.stateMachine.transitionTo("Connected", { version: pong.version || VERSION });
        this.replayOutboundQueue();
        return true;
      }
    } catch (err) {
      this.stateMachine.transitionTo("Error", { reason: "Reconnect PING failed" });
    }
    return false;
  }

  /**
   * Phase 7 Outbound Message Queue Replay
   */
  private async replayOutboundQueue(): Promise<void> {
    if (this.outboundQueue.length === 0) return;
    console.log(`${TAG} Replaying ${this.outboundQueue.length} queued message(s)...`);

    const queueToProcess = [...this.outboundQueue];
    this.outboundQueue = [];

    for (const item of queueToProcess) {
      try {
        const response = await this.send(item.type, item.payload);
        item.resolve(response);
      } catch (err) {
        item.reject(err);
      }
    }
  }

  /**
   * Send a typed message to the extension with context invalidation protection.
   */
  public async send<TResponse = any, TPayload = any>(
    type: TFMessageType,
    payload?: TPayload,
    timeoutMs: number = 6000
  ): Promise<TResponse> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const message: TFMessageEnvelope<TPayload> = {
      source: TF_SOURCE_WEB,
      type,
      requestId,
      timestamp: Date.now(),
      version: VERSION,
      payload,
    };

    return new Promise<TResponse>((resolve, reject) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId) && !resolved) {
          this.pendingRequests.delete(requestId);
          const error: TFMessageError = {
            code: "TIMEOUT",
            message: `Request '${type}' timed out after ${timeoutMs}ms.`,
            stage: type,
            suggestedAction: "Ensure TradeFourge Companion Extension is enabled and active.",
          };
          reject(error);
        }
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      const extensionId = this.refreshExtensionId();
      if (
        extensionId &&
        typeof window !== "undefined" &&
        (window as any).chrome?.runtime?.sendMessage
      ) {
        try {
          (window as any).chrome.runtime.sendMessage(
            extensionId,
            message,
            (response: any) => {
              const lastError = (window as any).chrome?.runtime?.lastError;
              if (lastError) {
                const isInvalidated = lastError.message.includes("Extension context invalidated");
                console.warn(`${TAG} chrome.runtime.lastError: ${lastError.message}`);

                if (!resolved) {
                  resolved = true;
                  clearTimeout(timer);
                  this.pendingRequests.delete(requestId);

                  if (isInvalidated) {
                    this.stateMachine.transitionTo("Recovering", { reason: lastError.message });
                    // Queue for replay if transient error
                    this.outboundQueue.push({ type, payload, resolve, reject, enqueuedAt: Date.now() });
                  } else {
                    reject({
                      code: "CONNECTION_LOST",
                      message: lastError.message,
                      stage: type,
                    });
                  }
                }
                return;
              }

              if (response && response.source === TF_SOURCE_EXTENSION && !resolved) {
                resolved = true;
                clearTimeout(timer);
                this.pendingRequests.delete(requestId);

                if (response.error) {
                  reject(response.error);
                } else {
                  resolve(response.payload ?? response);
                }
              }
            }
          );
        } catch (err: any) {
          console.warn(`${TAG} chrome.runtime.sendMessage threw exception:`, err);
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            this.pendingRequests.delete(requestId);

            const isContextError = String(err).includes("Extension context invalidated");
            if (isContextError) {
              this.stateMachine.transitionTo("Recovering", { reason: String(err) });
              this.outboundQueue.push({ type, payload, resolve, reject, enqueuedAt: Date.now() });
            } else {
              reject({
                code: "UNKNOWN_ERROR",
                message: err?.message || String(err),
                stage: type,
              });
            }
          }
        }
      } else {
        // Enqueue message if extension is offline or reconnecting
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          this.pendingRequests.delete(requestId);
          console.log(`${TAG} Extension unavailable. Enqueuing message for replay: ${type}`);
          this.outboundQueue.push({ type, payload, resolve, reject, enqueuedAt: Date.now() });
          this.stateMachine.transitionTo("Recovering", { reason: "Extension not reachable" });
        }
      }
    });
  }

  /**
   * Phase 4: Subscribe to specific extension message types with cleanup function return.
   */
  public subscribe(type: string, callback: EventCallback): () => void {
    if (!this.eventSubscribers.has(type)) {
      this.eventSubscribers.set(type, new Set());
    }
    this.eventSubscribers.get(type)!.add(callback);

    return () => {
      const subscribers = this.eventSubscribers.get(type);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.eventSubscribers.delete(type);
        }
      }
    };
  }

  public getBrowser(): "Chrome" | "Edge" | "Firefox" | "Brave" | "Unknown" {
    return this.browserName;
  }

  public getExtensionId(): string | null {
    return this.refreshExtensionId();
  }

  public hasChromeRuntime(): boolean {
    return typeof window !== "undefined" && !!(window as any).chrome?.runtime?.sendMessage;
  }
}
