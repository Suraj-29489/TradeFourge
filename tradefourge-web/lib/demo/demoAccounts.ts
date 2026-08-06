// lib/demo/demoAccounts.ts
// TradeFourge v4.1.0 — Demo Companion Account Engine
// Standardized demo provider simulating TradeForge Companion extension API & multi-account state.

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

export const INITIAL_DEMO_ACCOUNTS: CompanionAccount[] = [
  {
    id: "tfc_exness_live_1001",
    accountNumber: "2200009441",
    broker: "Exness Technologies",
    server: "Exness-Real14",
    accountType: "Live",
    currency: "USD",
    leverage: "1:500",
    balance: 10450.80,
    equity: 10620.40,
    margin: 420.00,
    freeMargin: 10200.40,
    profitToday: 169.60,
    floatingPnL: 169.60,
    isConnected: true,
    isDefault: true,
    lastScanTime: "Just Now",
    stats: {
      winRate: 68.4,
      profitFactor: 2.15,
      totalTrades: 38,
      winningTrades: 26,
      losingTrades: 12,
      netPnL: 450.80,
      maxDrawdownPct: 3.8,
      averageRR: 1.95,
    },
    trades: [
      {
        ticket: "9823101",
        symbol: "XAUUSD",
        type: "BUY",
        lots: 0.50,
        openPrice: 2742.50,
        closePrice: 2754.10,
        profit: 580.00,
        pips: 116,
        openTime: "2026-08-06 09:15:00",
        closeTime: "2026-08-06 11:30:00",
        status: "CLOSED",
      },
      {
        ticket: "9823088",
        symbol: "EURUSD",
        type: "SELL",
        lots: 1.00,
        openPrice: 1.0890,
        closePrice: 1.0855,
        profit: 350.00,
        pips: 35,
        openTime: "2026-08-05 14:00:00",
        closeTime: "2026-08-05 16:45:00",
        status: "CLOSED",
      },
      {
        ticket: "9822950",
        symbol: "GBPUSD",
        type: "BUY",
        lots: 0.75,
        openPrice: 1.2980,
        closePrice: 1.2940,
        profit: -300.00,
        pips: -40,
        openTime: "2026-08-04 10:20:00",
        closeTime: "2026-08-04 12:10:00",
        status: "CLOSED",
      },
      {
        ticket: "9822800",
        symbol: "USDJPY",
        type: "BUY",
        lots: 1.20,
        openPrice: 148.50,
        closePrice: 149.25,
        profit: 600.00,
        pips: 75,
        openTime: "2026-08-03 08:00:00",
        closeTime: "2026-08-03 15:30:00",
        status: "CLOSED",
      },
      {
        ticket: "9822610",
        symbol: "BTCUSD",
        type: "BUY",
        lots: 0.10,
        openPrice: 62400.00,
        closePrice: 61600.00,
        profit: -789.20,
        pips: -800,
        openTime: "2026-08-01 19:00:00",
        closeTime: "2026-08-02 04:00:00",
        status: "CLOSED",
      },
    ],
  },
  {
    id: "tfc_exness_demo_1002",
    accountNumber: "5500192847",
    broker: "Exness Practice",
    server: "Exness-Trial7",
    accountType: "Demo",
    currency: "USD",
    leverage: "1:1000",
    balance: 5320.00,
    equity: 5320.00,
    margin: 0.00,
    freeMargin: 5320.00,
    profitToday: 0.00,
    floatingPnL: 0.00,
    isConnected: true,
    isDefault: false,
    lastScanTime: "2 minutes ago",
    stats: {
      winRate: 54.5,
      profitFactor: 1.42,
      totalTrades: 22,
      winningTrades: 12,
      losingTrades: 10,
      netPnL: 320.00,
      maxDrawdownPct: 5.2,
      averageRR: 1.60,
    },
    trades: [
      {
        ticket: "7748190",
        symbol: "XAUUSD",
        type: "SELL",
        lots: 0.20,
        openPrice: 2750.00,
        closePrice: 2735.00,
        profit: 300.00,
        pips: 150,
        openTime: "2026-08-05 08:30:00",
        closeTime: "2026-08-05 10:15:00",
        status: "CLOSED",
      },
      {
        ticket: "7748010",
        symbol: "US30",
        type: "BUY",
        lots: 0.50,
        openPrice: 39100.00,
        closePrice: 38940.00,
        profit: -80.00,
        pips: -160,
        openTime: "2026-08-04 15:30:00",
        closeTime: "2026-08-04 17:00:00",
        status: "CLOSED",
      },
      {
        ticket: "7747990",
        symbol: "EURUSD",
        type: "BUY",
        lots: 0.50,
        openPrice: 1.0820,
        closePrice: 1.0840,
        profit: 100.00,
        pips: 20,
        openTime: "2026-08-03 11:00:00",
        closeTime: "2026-08-03 13:45:00",
        status: "CLOSED",
      },
    ],
  },
  {
    id: "tfc_icmarkets_1003",
    accountNumber: "891244012",
    broker: "IC Markets Global",
    server: "ICMarketsSC-Live03",
    accountType: "Prop",
    currency: "USD",
    leverage: "1:100",
    balance: 26840.50,
    equity: 27110.50,
    margin: 850.00,
    freeMargin: 26260.50,
    profitToday: 270.00,
    floatingPnL: 270.00,
    isConnected: true,
    isDefault: false,
    lastScanTime: "5 minutes ago",
    stats: {
      winRate: 72.5,
      profitFactor: 2.85,
      totalTrades: 40,
      winningTrades: 29,
      losingTrades: 11,
      netPnL: 1840.50,
      maxDrawdownPct: 2.4,
      averageRR: 2.10,
    },
    trades: [
      {
        ticket: "4410928",
        symbol: "NAS100",
        type: "BUY",
        lots: 2.00,
        openPrice: 19850.00,
        closePrice: 20020.00,
        profit: 1360.00,
        pips: 170,
        openTime: "2026-08-06 14:30:00",
        closeTime: "2026-08-06 16:00:00",
        status: "CLOSED",
      },
      {
        ticket: "4410888",
        symbol: "GBPUSD",
        type: "SELL",
        lots: 1.50,
        openPrice: 1.2950,
        closePrice: 1.2910,
        profit: 600.00,
        pips: 40,
        openTime: "2026-08-05 09:00:00",
        closeTime: "2026-08-05 12:30:00",
        status: "CLOSED",
      },
      {
        ticket: "4410710",
        symbol: "XAUUSD",
        type: "BUY",
        lots: 1.00,
        openPrice: 2730.00,
        closePrice: 2718.00,
        profit: -1200.00,
        pips: -120,
        openTime: "2026-08-02 10:00:00",
        closeTime: "2026-08-02 11:15:00",
        status: "CLOSED",
      },
    ],
  },
];
