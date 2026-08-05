import { CompanionHealth, CompanionLogEntry, CompanionState } from "./types";

export const MOCK_COMPANION_LOGS: CompanionLogEntry[] = [
  {
    id: "log-1",
    timestamp: "2026-08-05 21:40:12",
    severity: "SUCCESS",
    event: "Realtime Started",
    description: "WebSocket streaming pipeline established with Exness bridge.",
  },
  {
    id: "log-2",
    timestamp: "2026-08-05 21:40:05",
    severity: "SUCCESS",
    event: "History Imported",
    description: "Synchronized 4,862 historical trades across 3 trading accounts.",
  },
  {
    id: "log-3",
    timestamp: "2026-08-05 21:39:58",
    severity: "INFO",
    event: "Connected",
    description: "Extension runtime v1.2.0 handshake verified via window bridge.",
  },
  {
    id: "log-4",
    timestamp: "2026-08-05 21:39:50",
    severity: "INFO",
    event: "Heartbeat Received",
    description: "Latency check completed (43ms response time).",
  },
  {
    id: "log-5",
    timestamp: "2026-08-05 21:38:10",
    severity: "WARNING",
    event: "Reconnect",
    description: "Automatic background reconnect triggered after network shift.",
  },
];

export const DEFAULT_COMPANION_STATE: CompanionState = {
  isInstalled: true,
  isConnected: true,
  browser: "Chrome",
  version: "v1.2.0",
  lastHeartbeat: "2 seconds ago",
  latency: 43,
  connectionState: "connected",
  health: "Excellent",
  accountsCount: 3,
  historyStatus: "Imported",
  realtimeStatus: "Connected",
  lastSyncTime: "2 seconds ago",
  connectionTime: "2026-08-05 21:39:58",
  logs: MOCK_COMPANION_LOGS,
};

export function calculateHealth(latency: number, isConnected: boolean): CompanionHealth {
  if (!isConnected) return "Disconnected";
  if (latency < 100) return "Excellent";
  if (latency < 300) return "Good";
  if (latency < 800) return "Warning";
  return "Error";
}
