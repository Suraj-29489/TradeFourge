// lib/live-sync/broker-registry.ts
// TradeFourge v4.0 Broker Registry — Central Catalog of Supported Live Connectors

import type { LiveBrokerInfo } from "./broker-types";

export const BROKER_REGISTRY: LiveBrokerInfo[] = [
  {
    id: "exness",
    name: "Exness",
    category: "Production",
    platforms: ["MetaTrader 5", "MetaTrader 4", "Exness Terminal"],
    defaultServer: "Exness-Real",
    isConnectorReady: true,
  },
  {
    id: "mt5",
    name: "MetaTrader 5",
    category: "Production",
    platforms: ["MetaTrader 5"],
    defaultServer: "MetaQuotes-Demo",
    isConnectorReady: true,
  },
  {
    id: "mt4",
    name: "MetaTrader 4",
    category: "Supported",
    platforms: ["MetaTrader 4"],
    defaultServer: "MetaQuotes-MT4-Live",
    isConnectorReady: true,
  },
  {
    id: "ftmo",
    name: "FTMO",
    category: "Future-Ready",
    platforms: ["MetaTrader 5", "cTrader", "DXTrade"],
    defaultServer: "FTMO-Server",
    isConnectorReady: true,
  },
  {
    id: "icmarkets",
    name: "IC Markets",
    category: "Future-Ready",
    platforms: ["MetaTrader 5", "cTrader"],
    defaultServer: "ICMarkets-Live",
    isConnectorReady: true,
  },
  {
    id: "pepperstone",
    name: "Pepperstone",
    category: "Future-Ready",
    platforms: ["MetaTrader 5", "cTrader"],
    defaultServer: "Pepperstone-Live",
    isConnectorReady: true,
  },
  {
    id: "fundingpips",
    name: "FundingPips",
    category: "Future-Ready",
    platforms: ["Match Trader", "MetaTrader 5"],
    defaultServer: "FundingPips-Server",
    isConnectorReady: true,
  },
  {
    id: "matchtrader",
    name: "Match Trader",
    category: "Future-Ready",
    platforms: ["Match Trader"],
    defaultServer: "MatchTrader-Live",
    isConnectorReady: true,
  },
  {
    id: "ctrader",
    name: "cTrader",
    category: "Future-Ready",
    platforms: ["cTrader"],
    defaultServer: "cTrader-OpenAPI",
    isConnectorReady: true,
  },
];

export function getBrokerInfo(brokerId: string): LiveBrokerInfo | undefined {
  return BROKER_REGISTRY.find((b) => b.id.toLowerCase() === brokerId.toLowerCase());
}

export function getAllSupportedBrokers(): LiveBrokerInfo[] {
  return BROKER_REGISTRY;
}
