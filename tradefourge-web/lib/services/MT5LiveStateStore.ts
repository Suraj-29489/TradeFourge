export interface RawLivePosition {
  position_id: string | number;
  ticket?: string | number;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  open_time?: string;
  open_price: number;
  current_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  profit: number;
  swap?: number;
  magic_number?: number | null;
  comment?: string | null;
}

export interface RawLiveStatePayload {
  connector_id: string;
  account_number: string;
  observed_at: string;
  balance: number;
  equity: number;
  floating_pnl: number;
  margin: number;
  free_margin: number;
  margin_level?: number | null;
  positions: RawLivePosition[];
}

export interface StoredLiveState {
  userId: string;
  connectorId: string;
  accountId?: string;
  accountNumber: string;
  observedAt: string;
  receivedAt: string;
  balance: number;
  equity: number;
  floatingPnl: number;
  margin: number;
  freeMargin: number;
  marginLevel: number | null;
  positions: Array<{
    positionId: string;
    ticket: string;
    symbol: string;
    side: "BUY" | "SELL";
    volume: number;
    openTime: string;
    openPrice: number;
    currentPrice: number;
    stopLoss: number | null;
    takeProfit: number | null;
    profit: number;
    swap: number;
    magic: number | null;
    comment: string | null;
  }>;
}

class MT5LiveStateStore {
  // Key format: `${userId}:${accountNumber}`
  private store = new Map<string, StoredLiveState>();

  private getKey(userId: string, accountNumber: string): string {
    return `${userId}:${accountNumber.trim()}`;
  }

  setLiveState(
    userId: string,
    connectorId: string,
    accountId: string | undefined,
    payload: RawLiveStatePayload
  ): boolean {
    const key = this.getKey(userId, payload.account_number);
    const existing = this.store.get(key);

    const newObservedAt = new Date(payload.observed_at).getTime();
    if (existing) {
      const existingObservedAt = new Date(existing.observedAt).getTime();
      // Out-of-order protection: Reject older payload
      if (!isNaN(newObservedAt) && !isNaN(existingObservedAt) && newObservedAt < existingObservedAt) {
        console.warn(`[LiveStateStore] Out-of-order payload rejected for account ${payload.account_number}`);
        return false;
      }
    }

    const receivedAt = new Date().toISOString();
    const normalizedPositions = (payload.positions || []).map((pos) => {
      const ticketStr = String(pos.ticket || pos.position_id);
      return {
        positionId: String(pos.position_id || ticketStr),
        ticket: ticketStr,
        symbol: String(pos.symbol || "").toUpperCase(),
        side: (pos.side === "BUY" ? "BUY" : "SELL") as "BUY" | "SELL",
        volume: Number(pos.volume || 0),
        openTime: pos.open_time || receivedAt,
        openPrice: Number(pos.open_price || 0),
        currentPrice: Number(pos.current_price || pos.open_price || 0),
        stopLoss: pos.stop_loss !== undefined && pos.stop_loss !== null ? Number(pos.stop_loss) : null,
        takeProfit: pos.take_profit !== undefined && pos.take_profit !== null ? Number(pos.take_profit) : null,
        profit: Number(pos.profit || 0),
        swap: Number(pos.swap || 0),
        magic: pos.magic_number !== undefined && pos.magic_number !== null ? Number(pos.magic_number) : null,
        comment: pos.comment ? String(pos.comment) : null,
      };
    });

    const record: StoredLiveState = {
      userId,
      connectorId,
      accountId,
      accountNumber: String(payload.account_number),
      observedAt: payload.observed_at || receivedAt,
      receivedAt,
      balance: Number(payload.balance || 0),
      equity: Number(payload.equity || 0),
      floatingPnl: Number(payload.floating_pnl || 0),
      margin: Number(payload.margin || 0),
      freeMargin: Number(payload.free_margin || 0),
      marginLevel: payload.margin_level !== undefined && payload.margin_level !== null ? Number(payload.margin_level) : null,
      positions: normalizedPositions,
    };

    this.store.set(key, record);
    return true;
  }

  getLiveState(userId: string, accountNumber: string, staleThresholdMs = 10000): {
    state: StoredLiveState | null;
    isStale: boolean;
    lastUpdateSecAgo: number;
  } {
    const key = this.getKey(userId, accountNumber);
    const state = this.store.get(key) || null;

    if (!state) {
      return { state: null, isStale: true, lastUpdateSecAgo: -1 };
    }

    const receivedTime = new Date(state.receivedAt).getTime();
    const nowTime = Date.now();
    const elapsedMs = nowTime - receivedTime;
    const isStale = elapsedMs > staleThresholdMs;
    const lastUpdateSecAgo = Math.max(0, Math.floor(elapsedMs / 1000));

    return { state, isStale, lastUpdateSecAgo };
  }

  clearLiveState(userId?: string, accountNumber?: string): void {
    if (userId && accountNumber) {
      this.store.delete(this.getKey(userId, accountNumber));
    } else if (userId) {
      for (const [k, v] of this.store.entries()) {
        if (v.userId === userId) {
          this.store.delete(k);
        }
      }
    } else {
      this.store.clear();
    }
  }
}

// Global singleton instance across Next.js API requests
const globalForLiveState = globalThis as unknown as {
  mt5LiveStateStoreSingleton?: MT5LiveStateStore;
};

export const liveStateStore =
  globalForLiveState.mt5LiveStateStoreSingleton || new MT5LiveStateStore();

if (process.env.NODE_ENV !== "production") {
  globalForLiveState.mt5LiveStateStoreSingleton = liveStateStore;
}
