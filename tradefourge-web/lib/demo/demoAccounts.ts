// lib/demo/demoAccounts.ts
// TradeFourge Companion Account Protocol Interfaces & Types.
// All initial/fallback demo data removed for clean live data integration mode.

export interface CompanionTrade {
  ticket: string;
  symbol: string;
  type: "BUY" | "SELL";
  lots: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  pips: number;
  openTime: string;
  closeTime: string;
  status: "CLOSED" | "OPEN";
}

export interface CompanionAccount {
  id: string;
  accountNumber: string;
  broker: string;
  server: string;
  accountType: "Live" | "Demo" | "Prop";
  currency: string;
  leverage: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  profitToday: number;
  floatingPnL: number;
  isConnected: boolean;
  isDefault?: boolean;
  lastScanTime: string;
  stats: {
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    netPnL: number;
    maxDrawdownPct: number;
    averageRR: number;
  };
  trades: CompanionTrade[];
}

/**
  Initial accounts array is empty by default.
  Real trading accounts are discovered live via TradeFourge Companion bridge.
 */
export const INITIAL_DEMO_ACCOUNTS: CompanionAccount[] = [];
