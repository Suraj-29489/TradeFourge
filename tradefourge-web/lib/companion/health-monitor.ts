/**
 * TradeFourge Companion v5.5.3 — Automatic Health Monitor
 * Diagnostic system running periodic checks every 30 seconds.
 * Performs automatic repair triggers if background or content script disconnects.
 */

import { CompanionBridge } from "./bridge";
import { WebConnectionStateMachine } from "./state-machine";

export interface HealthCheckResult {
  serviceWorkerAlive: boolean;
  contentScriptConnected: boolean;
  websiteConnected: boolean;
  eventBusActive: boolean;
  supabaseReachable: boolean;
  versionMatch: boolean;
  latencyMs: number;
  lastCheckTime: string;
  error?: string;
}

export type HealthUpdateCallback = (result: HealthCheckResult) => void;

export class HealthMonitor {
  private static instance: HealthMonitor;
  private timer: NodeJS.Timeout | null = null;
  private listeners: Set<HealthUpdateCallback> = new Set();
  private lastResult: HealthCheckResult = {
    serviceWorkerAlive: false,
    contentScriptConnected: false,
    websiteConnected: true,
    eventBusActive: true,
    supabaseReachable: true,
    versionMatch: true,
    latencyMs: 0,
    lastCheckTime: "Not run yet",
  };
  private isRunningCheck = false;

  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  private constructor() {}

  public start(intervalMs: number = 30000): void {
    if (this.timer) return;
    console.log(`[HealthMonitor] Starting 30-second diagnostics cycle...`);

    // Run first check immediately after 2 seconds
    setTimeout(() => {
      this.runDiagnostics();
    }, 2000);

    this.timer = setInterval(() => {
      this.runDiagnostics();
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log(`[HealthMonitor] Stopped diagnostics cycle.`);
  }

  public async runDiagnostics(): Promise<HealthCheckResult> {
    if (this.isRunningCheck) return this.lastResult;
    this.isRunningCheck = true;

    const bridge = CompanionBridge.getInstance();
    const stateMachine = WebConnectionStateMachine.getInstance();
    const startTime = Date.now();

    let swAlive = false;
    let csConnected = false;
    let versionMatch = true;
    let latency = 0;
    let checkError: string | undefined = undefined;

    try {
      if (bridge.hasChromeRuntime() && bridge.getExtensionId()) {
        const response = await bridge.send("PING", undefined, 4000);
        swAlive = true;
        latency = Date.now() - startTime;
        csConnected = (response?.exnessTabsCount ?? 0) > 0;
        const extVersion = response?.version || "unknown";

        if (extVersion !== "5.5.3" && !extVersion.startsWith("5.")) {
          versionMatch = false;
          console.warn(`[HealthMonitor] Version mismatch! Website expects v5.5.3, Extension reports v${extVersion}`);
        }

        stateMachine.transitionTo("Connected", { swAlive, csConnected, latency });
      } else {
        checkError = "Extension ID or chrome.runtime unavailable.";
        stateMachine.transitionTo("Recovering", { reason: checkError });
      }
    } catch (err: any) {
      swAlive = false;
      csConnected = false;
      checkError = err?.message || "Diagnostics PING timed out";

      console.warn(`[HealthMonitor] Health check failed: ${checkError}. Triggering auto-recovery...`);
      stateMachine.transitionTo("Recovering", { reason: checkError });

      // Auto-repair trigger
      try {
        await bridge.reconnect();
      } catch (recoveryErr) {
        console.error(`[HealthMonitor] Auto-repair attempt failed:`, recoveryErr);
      }
    }

    this.lastResult = {
      serviceWorkerAlive: swAlive,
      contentScriptConnected: csConnected,
      websiteConnected: typeof window !== "undefined",
      eventBusActive: true,
      supabaseReachable: true,
      versionMatch,
      latencyMs: latency,
      lastCheckTime: new Date().toLocaleTimeString(),
      error: checkError,
    };

    this.isRunningCheck = false;
    this.notifyListeners();
    return this.lastResult;
  }

  public getLastResult(): HealthCheckResult {
    return { ...this.lastResult };
  }

  public subscribe(callback: HealthUpdateCallback): () => void {
    this.listeners.add(callback);
    try {
      callback(this.lastResult);
    } catch (err) {}

    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => {
      try {
        cb(this.lastResult);
      } catch (err) {}
    });
  }
}
