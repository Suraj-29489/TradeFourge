import { CompanionHealth } from "./types";

export function calculateHealth(latency: number, isConnected: boolean): CompanionHealth {
  if (!isConnected) return "Disconnected";
  if (latency <= 0) return "Disconnected";
  if (latency < 100) return "Excellent";
  if (latency < 300) return "Good";
  if (latency < 800) return "Warning";
  return "Error";
}
