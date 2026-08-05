import { DiscoveredAccount, ImportProgressPayload, TFMessageError } from "./protocol";

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
  lastHeartbeat: string | null;
  latency: number;
  connectionState: CompanionConnectionState;
  health: CompanionHealth;
  accountsCount: number;
  discoveredAccounts: DiscoveredAccount[];
  selectedAccountIds: string[];
  historyStatus: "Imported" | "Pending" | "Syncing";
  realtimeStatus: "Connected" | "Disconnected" | "Syncing";
  importProgress: ImportProgressPayload | null;
  lastSyncTime: string | null;
  connectionTime: string | null;
  logs: CompanionLogEntry[];
  lastError: TFMessageError | null;
}

export interface CompanionContextValue extends CompanionState {
  checkExtension: () => Promise<boolean>;
  discoverAccounts: () => Promise<DiscoveredAccount[]>;
  importSelectedAccounts: (accountIds: string[]) => Promise<boolean>;
  reconnect: () => Promise<void>;
  syncNow: () => Promise<void>;
  disconnect: () => void;
  repairConnection: () => Promise<void>;
  toggleAccountSelection: (accountNumber: string) => void;
  clearError: () => void;
}
