export type CompanionConnectionState = "connected" | "syncing" | "waiting" | "disconnected" | "error";
export type CompanionHealth = "Excellent" | "Good" | "Warning" | "Disconnected" | "Error";
export type LogSeverity = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export interface CompanionLogEntry {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  event: string;
  description: string;
}

export interface CompanionState {
  isInstalled: boolean;
  isConnected: boolean;
  browser: "Chrome" | "Edge" | "Firefox" | "Brave" | "Unknown";
  version: string;
  lastHeartbeat: string;
  latency: number;
  connectionState: CompanionConnectionState;
  health: CompanionHealth;
  accountsCount: number;
  historyStatus: "Imported" | "Pending" | "Syncing";
  realtimeStatus: "Connected" | "Disconnected" | "Syncing";
  lastSyncTime: string;
  connectionTime: string;
  logs: CompanionLogEntry[];
}

export interface CompanionContextValue extends CompanionState {
  checkExtension: () => Promise<boolean>;
  reconnect: () => Promise<void>;
  syncNow: () => Promise<void>;
  disconnect: () => void;
  repairConnection: () => Promise<void>;
  toggleMockInstallation: () => void;
}
