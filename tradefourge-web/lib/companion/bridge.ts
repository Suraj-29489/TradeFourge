/**
 * TradeFourge Companion v5.1 — Communication Bridge
 * Uses chrome.runtime.sendMessage(extensionId, message) for cross-tab Manifest V3 messaging.
 * Extension ID is discovered dynamically from DOM attribute set by injector.js content script.
 * Also receives push events from injector.js via window.postMessage (Background → Injector → Web).
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

const TAG = "[TradeFourge Web]";

export class CompanionBridge {
  private static instance: CompanionBridge;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private eventSubscribers: Map<string, Set<EventCallback>> = new Map();
  private isInitialized = false;
  private extensionId: string | null = null;
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
   * Discover the extension ID from the DOM attribute stamped by injector.js.
   * Also sets up a MutationObserver to detect it if it arrives after page load.
   */
  private discoverExtensionId() {
    if (typeof document === "undefined") return;

    // Try immediate read
    const id = document.documentElement.getAttribute("data-tradefourge-extension-id");
    if (id) {
      this.extensionId = id;
      console.log(`${TAG} Extension ID discovered from DOM: ${id}`);
      return;
    }

    // If not yet available, observe for it (injector runs at document_start, React hydrates later)
    console.log(`${TAG} Extension ID not found yet. Setting up MutationObserver...`);
    const observer = new MutationObserver(() => {
      const injectedId = document.documentElement.getAttribute("data-tradefourge-extension-id");
      if (injectedId) {
        this.extensionId = injectedId;
        console.log(`${TAG} Extension ID discovered via MutationObserver: ${injectedId}`);
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-tradefourge-extension-id"],
    });

    // Also try a retry loop as a safety net
    let retries = 0;
    const retryInterval = setInterval(() => {
      const retryId = document.documentElement.getAttribute("data-tradefourge-extension-id");
      if (retryId) {
        this.extensionId = retryId;
        console.log(`${TAG} Extension ID discovered via retry: ${retryId}`);
        clearInterval(retryInterval);
        observer.disconnect();
      }
      retries++;
      if (retries > 20) {
        console.warn(`${TAG} Extension ID not found after ${retries} retries. Extension may not be installed.`);
        clearInterval(retryInterval);
        observer.disconnect();
      }
    }, 250);
  }

  /**
   * Re-check for the extension ID. Called before each send attempt.
   */
  private refreshExtensionId(): string | null {
    if (this.extensionId) return this.extensionId;
    if (typeof document === "undefined") return null;
    const id = document.documentElement.getAttribute("data-tradefourge-extension-id");
    if (id) {
      this.extensionId = id;
      console.log(`${TAG} Extension ID refreshed: ${id}`);
    }
    return this.extensionId;
  }

  private initWindowListener() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Listen for window.postMessage responses (push event channel from background → injector → web)
    window.addEventListener("message", (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      const data = event.data as TFMessageEnvelope;
      if (data.source !== TF_SOURCE_EXTENSION) return;

      const payloadSize = JSON.stringify(data || {}).length;
      console.log(`${TAG} Injector → Website | type: ${data.type} | requestId: ${data.requestId || 'none'} | size: ${payloadSize}B | timestamp: ${Date.now()}`);

      // Resolve pending requests (request-response pattern)
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

      // Notify event subscribers (push event pattern — fires for ALL events)
      const subscribers = this.eventSubscribers.get(data.type);
      if (subscribers && subscribers.size > 0) {
        console.log(`${TAG} Notifying ${subscribers.size} subscriber(s) for ${data.type}`);
        subscribers.forEach((cb) => {
          try {
            cb(data);
          } catch (err) {
            console.error(`${TAG} Subscriber error for ${data.type}:`, err);
          }
        });
      }

      // Wildcard subscribers (receive ALL events)
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
   * Send a message to the extension and wait for a response.
   * Uses chrome.runtime.sendMessage(extensionId, message) exclusively.
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
      version: "5.1.0",
      payload,
    };

    const payloadSize = JSON.stringify(message).length;
    console.log(`${TAG} Website → Background | type: ${type} | requestId: ${requestId} | size: ${payloadSize}B | timestamp: ${Date.now()}`);

    return new Promise<TResponse>((resolve, reject) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId) && !resolved) {
          this.pendingRequests.delete(requestId);
          const error: TFMessageError = {
            code: "TIMEOUT",
            message: `Request '${type}' timed out after ${timeoutMs}ms. Extension did not respond.`,
            stage: type,
            suggestedAction: "Ensure TradeFourge Companion Extension is enabled and Exness tab is open.",
          };
          console.warn(`${TAG} ⏱ Request '${type}' timed out after ${timeoutMs}ms (requestId: ${requestId})`);
          reject(error);
        }
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      // ── PRIMARY: chrome.runtime.sendMessage(extensionId, message) ──
      const extensionId = this.refreshExtensionId();
      if (
        extensionId &&
        typeof window !== "undefined" &&
        (window as any).chrome?.runtime?.sendMessage
      ) {
        console.log(`${TAG} Dispatching via chrome.runtime.sendMessage(${extensionId}, ...)`);
        try {
          (window as any).chrome.runtime.sendMessage(
            extensionId,
            message,
            (response: any) => {
              // Check for Chrome runtime errors
              const lastError = (window as any).chrome?.runtime?.lastError;
              if (lastError) {
                console.error(`${TAG} chrome.runtime.lastError: ${lastError.message}`);
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timer);
                  this.pendingRequests.delete(requestId);
                  reject({
                    code: "CONNECTION_LOST",
                    message: lastError.message,
                    stage: type,
                    suggestedAction: "Check if Companion Extension is active in chrome://extensions",
                  });
                }
                return;
              }

              if (response && response.source === TF_SOURCE_EXTENSION && !resolved) {
                resolved = true;
                clearTimeout(timer);
                this.pendingRequests.delete(requestId);

                console.log(`${TAG} Background → Website | type: ${response.type} | requestId: ${requestId} | latency: ${Date.now() - message.timestamp}ms | status: SUCCESS`);

                if (response.error) {
                  reject(response.error);
                } else {
                  resolve(response.payload ?? response);
                }
              }
            }
          );
        } catch (err: any) {
          console.error(`${TAG} chrome.runtime.sendMessage threw:`, err);
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            this.pendingRequests.delete(requestId);
            reject({
              code: "UNKNOWN_ERROR",
              message: err?.message || String(err),
              stage: type,
            });
          }
        }
      } else {
        if (!extensionId) {
          console.warn(`${TAG} No Extension ID available. Extension may not be installed.`);
        }
        // Fallback: window.postMessage (only works if content script is in the same tab)
        if (typeof window !== "undefined") {
          console.log(`${TAG} Fallback: Dispatching via window.postMessage`);
          window.postMessage(message, "*");
        }
      }
    });
  }

  /**
   * Subscribe to specific extension message types.
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
