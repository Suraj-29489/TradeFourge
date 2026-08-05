import { DEFAULT_COMPANION_STATE } from "./status";
import { CompanionState } from "./types";

/**
 * Lightweight Companion Detection Service Interface.
 * Later this will hook into window.postMessage() or chrome.runtime.sendMessage()
 */
export class CompanionConnectionService {
  private static instance: CompanionConnectionService;

  public static getInstance(): CompanionConnectionService {
    if (!CompanionConnectionService.instance) {
      CompanionConnectionService.instance = new CompanionConnectionService();
    }
    return CompanionConnectionService.instance;
  }

  public async detectExtension(): Promise<boolean> {
    // Simulated detection check
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 400);
    });
  }

  public async pingHeartbeat(): Promise<{ latency: number; alive: boolean }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const latency = Math.floor(Math.random() * 25) + 30; // 30-55ms
        resolve({ latency, alive: true });
      }, 150);
    });
  }
}
