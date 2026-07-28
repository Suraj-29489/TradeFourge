-- =============================================================================
-- TradeFourge — Migration 20260728000100: Import Integrity & Deduplication
-- Version: v3.2.7
-- Target: PostgreSQL / Supabase
-- =============================================================================

-- 1. ADD external_trade_id COLUMN (FOR BROKER API / EXTERNAL SYNC)
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS external_trade_id TEXT DEFAULT NULL;

-- 2. CREATE INDEXES FOR FAST DEDUPLICATION
CREATE INDEX IF NOT EXISTS idx_trades_external_id
  ON public.trades(user_id, external_trade_id)
  WHERE external_trade_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_ticket_account
  ON public.trades(user_id, account_id, ticket)
  WHERE ticket IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_match_fallback
  ON public.trades(user_id, symbol, side, volume, open_time, close_time);

-- 3. PURGE EXISTING DUPLICATE TRADES SAFELY (PRESERVE EARLIEST RECORD BY ID)
DELETE FROM public.trades t1
USING public.trades t2
WHERE t1.id > t2.id
  AND t1.user_id = t2.user_id
  AND (
    (t1.external_trade_id IS NOT NULL AND t1.external_trade_id = t2.external_trade_id)
    OR
    (t1.ticket IS NOT NULL AND t1.ticket <> '' AND t1.ticket = t2.ticket AND COALESCE(t1.account_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(t2.account_id, '00000000-0000-0000-0000-000000000000'::uuid))
    OR
    (
      t1.symbol = t2.symbol
      AND t1.side = t2.side
      AND t1.volume = t2.volume
      AND COALESCE(t1.open_time, t1.created_at) = COALESCE(t2.open_time, t2.created_at)
      AND COALESCE(t1.close_time, t1.created_at) = COALESCE(t2.close_time, t2.created_at)
    )
  );

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
