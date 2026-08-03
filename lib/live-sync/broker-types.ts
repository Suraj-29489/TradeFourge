// lib/live-sync/broker-types.ts
// TradeFourge v4.0 Live Broker Sync Engine — Core Types & Interface Definitions

import type {
  AccountPlatform,
  LiveConnectionStatus,
  SyncIntervalSetting,
  TradeSide,
  TradeOutcome,
} from "@/types/database";

export interface LiveBrokerInfo {
  id: string;
  name: string;
  category: "Production" | "Supported" | "Future-Ready";
  platforms: AccountPlatform[];
  defaultServer: string;
  logoUrl?: string;
  isConnectorReady: boolean;
}

export interface LiveTradePayload {
  ticket: string;
  positionId?: string;
  symbol: string;
  side: TradeSide;
  volume: number;
  openPrice: number;
  closePrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  openTime: string;
  closeTime?: string | null;
  profit: number;
  commission: number;
  swap: number;
  magicNumber?: number | null;
  notes?: string | null;
  outcome?: TradeOutcome;
}

export interface LiveAccountSummary {
  accountName: string;
  brokerName: string;
  loginNumber: string;
  server: string;
  platform: AccountPlatform;
  currency: string;
  balance: number;
  equity: number;
  margin?: number;
  freeMargin?: number;
  leverage?: string;
  accountType?: string;
  openPositions: LiveTradePayload[];
  closedTrades: LiveTradePayload[];
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  accountSummary?: LiveAccountSummary;
  error?: string;
}

export interface IBrokerConnector {
  brokerId: string;
  brokerName: string;
  platform: AccountPlatform;

  authenticate(credentials: {
    server: string;
    loginNumber: string;
    authSecret: string;
  }): Promise<boolean>;

  verifyOwnership(): Promise<boolean>;

  fetchAccountSummary(): Promise<LiveAccountSummary>;

  fetchIncrementalTrades(checkpointTime: string | null): Promise<{
    openPositions: LiveTradePayload[];
    closedTrades: LiveTradePayload[];
  }>;
}

export interface ConflictResolutionResult {
  action: "IMPORT" | "UPDATE" | "SKIP" | "ARCHIVE";
  reason: string;
  existingTradeId?: string;
}
