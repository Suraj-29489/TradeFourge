import { BrokerParser } from "@/types/trade";
import { ExnessParser } from "./exness";

export const availableParsers: BrokerParser[] = [
  ExnessParser,
  // Future parsers like MetaTrader4Parser, TradingViewParser, TraderSyncParser can be registered here.
];

export function getParserById(id: string): BrokerParser | undefined {
  return availableParsers.find((p) => p.id === id);
}
