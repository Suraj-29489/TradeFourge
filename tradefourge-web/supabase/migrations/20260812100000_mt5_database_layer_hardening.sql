-- =============================================================================
-- TradeFourge v5.7.0 — MT5 Database Layer Hardening Migration
-- Version: 5.7.0
-- Description: Adds persistent account metadata columns, account uniqueness index,
--              sync run tracking fields, and analytics performance indexes for trades.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: EXTEND TRADING_ACCOUNTS WITH PERSISTENT LIVE-STATE METADATA
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS equity               NUMERIC(15, 2);
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS free_margin          NUMERIC(15, 2);
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS margin               NUMERIC(15, 2);
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS margin_level         NUMERIC(15, 2);
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS is_connected         BOOLEAN DEFAULT false;
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS last_seen_at         TIMESTAMPTZ;
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS last_history_sync_at    TIMESTAMPTZ;

-- Partial Unique Index for Account Identity Uniqueness
-- Prevents duplicate account creation for the same user + broker + account_number combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_trading_accounts_mt5_identity
    ON public.trading_accounts (user_id, account_number, broker)
    WHERE account_number IS NOT NULL;

-- Fast Lookup Index by (user_id, account_number)
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_account_number
    ON public.trading_accounts (user_id, account_number);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: ENHANCE MT5_SYNC_BATCHES FOR DETAILED SYNC RUN OBSERVABILITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.mt5_sync_batches ADD COLUMN IF NOT EXISTS sync_type     TEXT DEFAULT 'HISTORY' CHECK (sync_type IN ('ACCOUNT', 'HISTORY', 'RECONCILIATION'));
ALTER TABLE public.mt5_sync_batches ADD COLUMN IF NOT EXISTS started_at    TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.mt5_sync_batches ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ;
ALTER TABLE public.mt5_sync_batches ADD COLUMN IF NOT EXISTS request_id    TEXT;
ALTER TABLE public.mt5_sync_batches ADD COLUMN IF NOT EXISTS error_code    TEXT;

CREATE INDEX IF NOT EXISTS idx_mt5_sync_batches_sync_type ON public.mt5_sync_batches(user_id, sync_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: ADD PERFORMANCE INDEXES ON TRADES FOR WORKSPACE & ANALYTICS QUERIES
-- ─────────────────────────────────────────────────────────────────────────────

-- Calendar Workspace: query closed trades by account + date range
CREATE INDEX IF NOT EXISTS idx_trades_account_close_time
    ON public.trades (account_id, close_time DESC)
    WHERE close_time IS NOT NULL;

-- Symbol Analytics: aggregate by symbol per account
CREATE INDEX IF NOT EXISTS idx_trades_account_symbol
    ON public.trades (account_id, symbol);

-- Outcome Filtering: win/loss calculations
CREATE INDEX IF NOT EXISTS idx_trades_account_outcome
    ON public.trades (account_id, outcome);

-- User-wide Chronological Trade Querying
CREATE INDEX IF NOT EXISTS idx_trades_user_close_time
    ON public.trades (user_id, close_time DESC)
    WHERE close_time IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: NOTIFY POSTGREST SCHEMA RELOAD
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
