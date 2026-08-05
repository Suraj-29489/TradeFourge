/**
 * TradeFourge Companion v2.0 — Production Communication Bridge
 * Manages window.postMessage & chrome.runtime.sendMessage asynchronous dispatching.
 */

import {
  TF_MESSAGE_TYPES,
  TF_SOURCE_EXTENSION,
  TF_SOURCE_WEB,
  TFMessageEnvelope,
  TFMessageError,
  TFMessageType,
} from "./protocol";

type EventCallback = (message: TFMessageEnvelope) => void;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
}

export class CompanionBridge {
  private static instance: CompanionBridge;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private eventSubscribers: Map<string, Set<EventCallback>> = new Map();
  private isInitialized = false;
  private extensionInstalled = false;
  private extensionVersion = "";
  private browserName: "Chrome" | "Edge" | "Firefox" | "Brave" | "Unknown" = "Unknown";

  public static getInstance(): CompanionBridge {
    if (!CompanionBridge.instance) {
      CompanionBridge.instance = new CompanionBridge();
    }
    return CompanionBridge.instance;
  }

  private constructor() {
    this.detectBrowser();
    if (typeof window !== "undefined") {
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

  private initWindowListener() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    window.addEventListener("message", (event: MessageEvent) => {
      // Ensure origin and source check
      if (!event.data || typeof event.data !== "object") return;
      const data = event.data as TFMessageEnvelope;

      if (data.source !== TF_SOURCE_EXTENSION) return;

      // 1. Resolve pending request promises if requestId matches
      if (data.requestId && this.pendingRequests.has(data.requestId)) {
        const pending = this.pendingRequests.get(data.requestId)!;
        clearTimeout(pending.timer);
        this.pendingRequests.delete(data.requestId);

        if (data.type === TF_MESSAGE_TYPES.ERROR || data.error) {
          pending.reject(
            data.error || {
              code: "UNKNOWN_ERROR",
              message: "An unknown error occurred during extension request.",
            }
          );
        } else {
          pending.resolve(data.payload);
        }
      }

      // 2. Notify event subscribers
      const subscribers = this.eventSubscribers.get(data.type);
      if (subscribers) {
        subscribers.forEach((cb) => cb(data));
      }

      // Broadcast wildcard subscribers
      const wildcardSubscribers = this.eventSubscribers.get("*");
      if (wildcardSubscribers) {
        wildcardSubscribers.forEach((cb) => cb(data));
      }
    });
  }

  /**
   * Dispatch a message to the extension and wait for response.
   */
  public async send<TResponse = any, TPayload = any>(
    type: TFMessageType,
    payload?: TPayload,
    timeoutMs: number = 8000
  ): Promise<TResponse> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const message: TFMessageEnvelope<TPayload> = {
      source: TF_SOURCE_WEB,
      type,
      requestId,
      timestamp: Date.now(),
      version: "2.0.0",
      payload,
    };

    return new Promise<TResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          const error: TFMessageError = {
            code: "TIMEOUT",
            message: `Request '${type}' timed out after ${timeoutMs}ms. Extension did not respond.`,
          };
          reject(error);
        }
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      // Method A: Post message via window
      if (typeof window !== "undefined") {
        window.postMessage(message, "*");
      }

      // Method B: Send message via chrome.runtime.sendMessage if extension ID is known or injected
      if (
        typeof window !== "undefined" &&
        (window as any).chrome &&
        (window as any).chrome.runtime &&
        (window as any).chrome.runtime.sendMessage
      ) {
        try {
          (window as any).chrome.runtime.sendMessage(message, (response: any) => {
            if (response && this.pendingRequests.has(requestId)) {
              clearTimeout(timer);
              this.pendingRequests.delete(requestId);
              if (response.error) {
                reject(response.error);
              } else {
                resolve(response.payload ?? response);
              }
            }
          });
        } catch {
          // Fall back to window.postMessage handler
        }
      }
    });
  }

  /**
   * Subscribe to specific extension message types (e.g. LIVE_EVENT, IMPORT_PROGRESS)
   */
  public subscribe(type: string, callback: EventCallback): () => void {
    if (!this.eventSubscribers.has(type)) {
      this.eventSubscribers.set(type, new Set());
    }
    this.eventSubscribers.get(type)!.add(callback);

    // Unsubscribe function
    return () => {
      const subscribers = this.eventSubscribers.get(type);
      if (subscribers) {
        subscribers.delete(callback);
      }
    };
  }

  public getBrowser(): "Chrome" | "Edge" | "Firefox" | "Brave" | "Unknown" {
    return this.browserName;
  }
}
