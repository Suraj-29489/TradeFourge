import {
  MT5DataProvider,
  MT5Account,
  MT5Trade,
  MT5TradeFilter,
  MT5Timeframe,
  MT5EquityPoint,
} from "@/types/mt5";
import { INITIAL_MOCK_ACCOUNTS, INITIAL_MOCK_TRADES, generateEquityCurve } from "./mockData";

export class MockMT5DataProvider implements MT5DataProvider {
  private accounts: MT5Account[] = [...INITIAL_MOCK_ACCOUNTS];
  private trades: MT5Trade[] = [...INITIAL_MOCK_TRADES];

  private async delay(ms = 600): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getAccounts(): Promise<MT5Account[]> {
    await this.delay(300);
    return [...this.accounts];
  }

  async getAccount(accountId: string): Promise<MT5Account | null> {
    await this.delay(200);
    const acc = this.accounts.find((a) => a.id === accountId || a.accountNumber === accountId);
    return acc ? { ...acc } : null;
  }

  async addAccount(accountData: Omit<MT5Account, "id" | "balance" | "equity" | "freeMargin" | "floatingPnl" | "profitToday" | "connectionStatus" | "lastUpdated"> & { password?: string }): Promise<MT5Account> {
    await this.delay(1000);
    const newId = `acc_mt5_${accountData.accountNumber}`;
    const newAcc: MT5Account = {
      ...accountData,
      id: newId,
      balance: 1000.0,
      equity: 1000.0,
      freeMargin: 1000.0,
      floatingPnl: 0.0,
      profitToday: 0.0,
      connectionStatus: "Connected",
      lastUpdated: new Date().toISOString(),
    };
    this.accounts.push(newAcc);
    return { ...newAcc };
  }

  async refreshAccount(accountId: string): Promise<MT5Account> {
    await this.delay(800);
    const index = this.accounts.findIndex((a) => a.id === accountId || a.accountNumber === accountId);
    if (index === -1) throw new Error("Account not found");

    const acc = this.accounts[index];
    const updatedAcc: MT5Account = {
      ...acc,
      lastUpdated: new Date().toISOString(),
      connectionStatus: "Connected",
      floatingPnl: Number((acc.floatingPnl + (Math.random() - 0.5) * 0.8).toFixed(2)),
      equity: Number((acc.balance + acc.floatingPnl + 2.0).toFixed(2)),
    };
    this.accounts[index] = updatedAcc;
    return { ...updatedAcc };
  }

  async disconnectAccount(accountId: string): Promise<boolean> {
    await this.delay(400);
    const index = this.accounts.findIndex((a) => a.id === accountId || a.accountNumber === accountId);
    if (index !== -1) {
      this.accounts[index].connectionStatus = "Disconnected";
      return true;
    }
    return false;
  }

  async getTrades(accountId: string, filter?: MT5TradeFilter): Promise<MT5Trade[]> {
    await this.delay(400);
    const acc = this.accounts.find((a) => a.id === accountId || a.accountNumber === accountId);
    const accNum = acc ? acc.accountNumber : accountId;

    let result = this.trades.filter((t) => t.accountNumber === accNum || !accountId);

    if (filter) {
      if (filter.startDate) {
        result = result.filter((t) => t.openTime >= filter.startDate!);
      }
      if (filter.endDate) {
        result = result.filter((t) => t.openTime <= filter.endDate!);
      }
      if (filter.symbol && filter.symbol !== "ALL") {
        result = result.filter((t) => t.symbol.toLowerCase() === filter.symbol!.toLowerCase());
      }
      if (filter.side && filter.side !== "ALL") {
        result = result.filter((t) => t.side === filter.side);
      }
      if (filter.status && filter.status !== "ALL") {
        result = result.filter((t) => t.status === filter.status);
      }
      if (filter.search && filter.search.trim()) {
        const q = filter.search.toLowerCase();
        result = result.filter(
          (t) =>
            t.ticket.toLowerCase().includes(q) ||
            t.symbol.toLowerCase().includes(q) ||
            t.orderId.toLowerCase().includes(q)
        );
      }
    }

    return result.sort((a, b) => new Date(b.openTime).getTime() - new Date(a.openTime).getTime());
  }

  async fetchHistoricalTrades(accountId: string, fromDate: string, toDate: string): Promise<{ addedCount: number }> {
    await this.delay(1200);
    const acc = this.accounts.find((a) => a.id === accountId || a.accountNumber === accountId);
    const accNum = acc ? acc.accountNumber : accountId;

    // Simulate fetching additional trades into mock array
    const newCount = 5;
    let maxTicket = Math.max(...this.trades.map((t) => parseInt(t.ticket, 10) || 1000000));

    for (let i = 0; i < newCount; i++) {
      maxTicket++;
      this.trades.push({
        ticket: maxTicket.toString(),
        orderId: `ORD-${maxTicket + 5000}`,
        accountNumber: accNum,
        symbol: i % 2 === 0 ? "XAUUSD" : "EURUSD",
        side: i % 2 === 0 ? "BUY" : "SELL",
        volume: 0.01,
        openTime: `${fromDate}T10:00:00.000Z`,
        closeTime: `${fromDate}T11:30:00.000Z`,
        openPrice: 2420.0,
        closePrice: 2425.5,
        stopLoss: 2410.0,
        takeProfit: 2440.0,
        commission: -0.2,
        swap: -0.05,
        profit: 5.5,
        status: "CLOSED",
      });
    }

    return { addedCount: newCount };
  }

  async getEquityHistory(accountId: string, timeframe: MT5Timeframe): Promise<{
    points: MT5EquityPoint[];
    startingBalance: number;
    currentEquity: number;
    high: number;
    low: number;
  }> {
    await this.delay(300);
    const acc = this.accounts.find((a) => a.id === accountId || a.accountNumber === accountId);
    const balance = acc ? acc.balance : 514.0;
    return generateEquityCurve(timeframe, balance);
  }
}

export const defaultMT5DataProvider = new MockMT5DataProvider();
