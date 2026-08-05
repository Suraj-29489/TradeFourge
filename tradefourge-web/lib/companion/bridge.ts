/**
 * TradeFourge Companion v3.2 — Communication Bridge
 * Asynchronous dispatching supporting window.postMessage & chrome.runtime.sendMessage cross-tab pipeline.
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
      if (!event.data || typeof event.data !== "object") return;
      const data = event.data as TFMessageEnvelope;

      if (data.source !== TF_SOURCE_EXTENSION) return;

      console.log(`[TradeFourge Web] Received ${data.type} response from Extension via window.postMessage:`, data);

      if (data.requestId && this.pendingRequests.has(data.requestId)) {
        const pending = this.pendingRequests.get(data.requestId)!;
        clearTimeout(pending.timer);
        this.pendingRequests.delete(data.requestId);

        if (data.type === TF_MESSAGE_TYPES.ERROR || data.error) {
          pending.reject(data.error);
        } else {
          pending.resolve(data.payload);
        }
      }

      const subscribers = this.eventSubscribers.get(data.type);
      if (subscribers) {
        subscribers.forEach((cb) => cb(data));
      }
    });
  }

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
      version: "3.2.0",
      payload,
    };

    console.log(`[TradeFourge Web] Sending ${type} to Extension (requestId: ${requestId})...`);

    return new Promise<TResponse>((resolve, reject) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          const error: TFMessageError = {
            code: "TIMEOUT",
            message: `Request '${type}' timed out after ${timeoutMs}ms. Extension did not respond.`,
          };
          console.warn(`[TradeFourge Web] Request '${type}' timed out.`);
          reject(error);
        }
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      // Method A: Try chrome.runtime.sendMessage if available
      if (
        typeof window !== "undefined" &&
        (window as any).chrome &&
        (window as any).chrome.runtime &&
        (window as any).chrome.runtime.sendMessage
      ) {
        try {
          console.log(`[TradeFourge Web] Dispatching ${type} via chrome.runtime.sendMessage...`);
          (window as any).chrome.runtime.sendMessage(message, (response: any) => {
            if (response && response.source === TF_SOURCE_EXTENSION && !resolved) {
              resolved = true;
              clearTimeout(timer);
              this.pendingRequests.delete(requestId);
              console.log(`[TradeFourge Web] Received ${response.type} response via chrome.runtime.sendMessage:`, response);
              if (response.error) {
                reject(response.error);
              } else {
                resolve(response.payload ?? response);
              }
            }
          });
        } catch {
          // Fall back to window.postMessage
        }
      }

      // Method B: Dispatch window.postMessage
      if (typeof window !== "undefined") {
        console.log(`[TradeFourge Web] Dispatching ${type} via window.postMessage...`);
        window.postMessage(message, "*");
      }
    });
  }

  public subscribe(type: string, callback: EventCallback): () => void {
    if (!this.eventSubscribers.has(type)) {
      this.eventSubscribers.set(type, new Set());
    }
    this.eventSubscribers.get(type)!.add(callback);

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
