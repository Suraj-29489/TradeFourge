import { MT5Account, MT5Trade, MT5EquityPoint, MT5Timeframe } from "@/types/mt5";

export const INITIAL_MOCK_ACCOUNTS: MT5Account[] = [
  {
    id: "acc_mt5_267588210",
    accountNumber: "267588210",
    password: "exnessSecretKey88",
    server: "Exness-MT5Real39",
    accountType: "Standard",
    currency: "USD",
    leverage: "1:2000",
    balance: 514.0,
    equity: 520.42,
    freeMargin: 495.18,
    floatingPnl: 2.17,
    profitToday: 6.42,
    connectionStatus: "Connected",
    lastUpdated: "2026-08-11T18:30:00.000Z",
  },
  {
    id: "acc_mt5_105140877",
    accountNumber: "105140877",
    password: "tradeSecretPass15",
    server: "Exness-MT5Real15",
    accountType: "Standard",
    currency: "USD",
    leverage: "1:2000",
    balance: 1245.5,
    equity: 1241.1,
    freeMargin: 1210.0,
    floatingPnl: -4.4,
    profitToday: 14.8,
    connectionStatus: "Connected",
    lastUpdated: "2026-08-11T18:25:00.000Z",
  },
];

// Helper generator for mock trades
function generateMockTrades(): MT5Trade[] {
  const symbols = [
    { symbol: "XAUUSD", basePrice: 2435.0, lot: 0.01, slOffset: 12, tpOffset: 25 },
    { symbol: "BTCUSD", basePrice: 64800.0, lot: 0.01, slOffset: 450, tpOffset: 900 },
    { symbol: "EURUSD", basePrice: 1.092, lot: 0.1, slOffset: 0.003, tpOffset: 0.006 },
    { symbol: "GBPUSD", basePrice: 1.284, lot: 0.1, slOffset: 0.004, tpOffset: 0.008 },
    { symbol: "USDJPY", basePrice: 147.5, lot: 0.05, slOffset: 0.6, tpOffset: 1.2 },
  ];

  const trades: MT5Trade[] = [];
  let ticketCounter = 1000100;
  const mainAccount = "267588210";
  const secondAccount = "105140877";

  // Create trades across dates from June 1, 2026 to August 11, 2026
  const days: { date: string; count: number }[] = [
    { date: "2026-08-11", count: 4 },
    { date: "2026-08-10", count: 5 },
    { date: "2026-08-08", count: 3 },
    { date: "2026-08-07", count: 6 },
    { date: "2026-08-06", count: 4 },
    { date: "2026-08-05", count: 5 },
    { date: "2026-08-04", count: 3 },
    { date: "2026-08-03", count: 4 },
    { date: "2026-07-31", count: 3 },
    { date: "2026-07-30", count: 4 },
    { date: "2026-07-29", count: 2 },
    { date: "2026-07-28", count: 3 },
    { date: "2026-07-27", count: 4 },
    { date: "2026-07-24", count: 3 },
    { date: "2026-07-23", count: 2 },
    { date: "2026-07-22", count: 3 },
    { date: "2026-07-21", count: 2 },
    { date: "2026-07-20", count: 3 },
  ];

  days.forEach(({ date, count }) => {
    for (let i = 0; i < count; i++) {
      ticketCounter++;
      const sym = symbols[(ticketCounter + i) % symbols.length];
      const isBuy = (ticketCounter + i) % 2 === 0;
      const hour = 8 + ((i * 3 + ticketCounter) % 11);
      const minute = (i * 17 + 8) % 60;
      const second = (i * 23 + 12) % 60;
      const openTime = `${date}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}.000Z`;

      // 1 open trade for today, rest closed
      const isOpen = date === "2026-08-11" && i === 0;
      const closeHour = Math.min(23, hour + 1);
      const closeTime = isOpen ? null : `${date}T${closeHour.toString().padStart(2, "0")}:${(minute + 15) % 60}:${second}.000Z`;

      const isWin = (ticketCounter * 7 + i) % 3 !== 0;
      let profit = 0;
      if (isOpen) {
        profit = isWin ? 2.17 : -1.45;
      } else {
        profit = isWin ? Number((Math.random() * 8 + 2).toFixed(2)) : -Number((Math.random() * 5 + 1).toFixed(2));
      }

      const openPrice = Number((sym.basePrice + (Math.random() - 0.5) * (sym.basePrice * 0.005)).toFixed(sym.symbol.includes("USD") && !sym.symbol.includes("XAU") && !sym.symbol.includes("BTC") && !sym.symbol.includes("JPY") ? 5 : 2));
      const priceShift = isWin ? (isBuy ? sym.tpOffset * 0.5 : -sym.tpOffset * 0.5) : (isBuy ? -sym.slOffset * 0.5 : sym.slOffset * 0.5);
      const closePrice = isOpen ? null : Number((openPrice + priceShift).toFixed(openPrice > 100 ? 2 : 5));

      const acc = i % 3 === 0 ? secondAccount : mainAccount;

      trades.push({
        ticket: ticketCounter.toString(),
        orderId: `ORD-${ticketCounter + 4000}`,
        accountNumber: acc,
        symbol: sym.symbol,
        side: isBuy ? "BUY" : "SELL",
        volume: sym.lot,
        openTime,
        closeTime,
        openPrice,
        closePrice,
        stopLoss: isBuy ? Number((openPrice - sym.slOffset).toFixed(2)) : Number((openPrice + sym.slOffset).toFixed(2)),
        takeProfit: isBuy ? Number((openPrice + sym.tpOffset).toFixed(2)) : Number((openPrice - sym.tpOffset).toFixed(2)),
        commission: -0.2,
        swap: -0.05,
        profit,
        status: isOpen ? "OPEN" : "CLOSED",
      });
    }
  });

  return trades;
}

export const INITIAL_MOCK_TRADES: MT5Trade[] = generateMockTrades();

export function generateEquityCurve(timeframe: MT5Timeframe, currentBalance = 514.0): {
  points: MT5EquityPoint[];
  startingBalance: number;
  currentEquity: number;
  high: number;
  low: number;
} {
  let count = 24;
  let labelFormat: (i: number) => string;

  switch (timeframe) {
    case "1H":
      count = 12;
      labelFormat = (i) => `${(18 - (11 - i) + 24) % 24}:00`;
      break;
    case "4H":
      count = 16;
      labelFormat = (i) => `Day ${Math.floor(i / 4) + 1} ${((i % 4) * 6).toString().padStart(2, "0")}:00`;
      break;
    case "1D":
      count = 24;
      labelFormat = (i) => `${i.toString().padStart(2, "0")}:00`;
      break;
    case "1W":
      count = 7;
      labelFormat = (i) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i % 7];
      break;
    case "1M":
      count = 30;
      labelFormat = (i) => `Aug ${i + 1}`;
      break;
    default:
      count = 24;
      labelFormat = (i) => `${i}:00`;
  }

  const start = currentBalance - 26.42;
  const points: MT5EquityPoint[] = [];
  let running = start;
  let high = running;
  let low = running;

  for (let i = 0; i < count; i++) {
    const stepDelta = (Math.sin(i * 0.7) * 4.5) + (i / count) * 20.0 + (Math.random() - 0.4) * 3.0;
    running = Number((start + stepDelta).toFixed(2));
    if (running > high) high = running;
    if (running < low) low = running;

    points.push({
      timestamp: labelFormat(i),
      equity: running,
      balance: Number((start + (i / count) * 18.0).toFixed(2)),
    });
  }

  const currentEquity = points[points.length - 1]?.equity ?? currentBalance;

  return {
    points,
    startingBalance: Number(start.toFixed(2)),
    currentEquity: Number(currentEquity.toFixed(2)),
    high: Number(high.toFixed(2)),
    low: Number(low.toFixed(2)),
  };
}
