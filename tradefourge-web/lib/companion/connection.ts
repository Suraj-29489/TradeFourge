import { CompanionBridge } from "./bridge";
import { TF_MESSAGE_TYPES } from "./protocol";

/**
 * Lightweight Companion Detection Service Interface.
 * Wraps CompanionBridge for ping detection and latency heartbeats.
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
    try {
      const response = await CompanionBridge.getInstance().send(TF_MESSAGE_TYPES.PING, undefined, 3000);
      return Boolean(response);
    } catch {
      return false;
    }
  }

  public async pingHeartbeat(): Promise<{ latency: number; alive: boolean }> {
    const startTime = Date.now();
    try {
      await CompanionBridge.getInstance().send(TF_MESSAGE_TYPES.HEARTBEAT, undefined, 3000);
      const latency = Math.max(1, Date.now() - startTime);
      return { latency, alive: true };
    } catch {
      return { latency: 0, alive: false };
    }
  }
}
