-- =============================================================================
-- TradeFourge v5.6.0 — MT5 Connector Backend Foundation Migration
-- Version: 5.6.0
-- Description: Establishes mt5_connectors and mt5_sync_batches tables,
--              extends trading_accounts and trades with MT5 metadata,
--              and creates partial unique index for idempotent deal ingestion.
-- =============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: MT5 CONNECTORS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mt5_connectors (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connector_name   TEXT NOT NULL DEFAULT 'Desktop Connector',
    api_key_hash     TEXT NOT NULL UNIQUE,
    api_key_prefix   TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    last_heartbeat   TIMESTAMPTZ,
    last_ip          TEXT,
    version          TEXT DEFAULT '1.0.0',
    paired_accounts  INT DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    revoked_at       TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mt5_connectors_user_id ON public.mt5_connectors(user_id);
CREATE INDEX IF NOT EXISTS idx_mt5_connectors_status ON public.mt5_connectors(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mt5_connectors_api_key_hash ON public.mt5_connectors(api_key_hash);

-- RLS
ALTER TABLE public.mt5_connectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mt5_connectors_select_own" ON public.mt5_connectors;
DROP POLICY IF EXISTS "mt5_connectors_insert_own" ON public.mt5_connectors;
DROP POLICY IF EXISTS "mt5_connectors_update_own" ON public.mt5_connectors;
DROP POLICY IF EXISTS "mt5_connectors_delete_own" ON public.mt5_connectors;

CREATE POLICY "mt5_connectors_select_own" ON public.mt5_connectors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mt5_connectors_insert_own" ON public.mt5_connectors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mt5_connectors_update_own" ON public.mt5_connectors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "mt5_connectors_delete_own" ON public.mt5_connectors FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: MT5 SYNC BATCHES TABLE (Audit Trail)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mt5_sync_batches (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connector_id     UUID NOT NULL REFERENCES public.mt5_connectors(id) ON DELETE CASCADE,
    account_id       UUID REFERENCES public.trading_accounts(id) ON DELETE SET NULL,
    batch_type       TEXT NOT NULL DEFAULT 'closed_trades' CHECK (batch_type IN ('closed_trades', 'account_update', 'full_history')),
    total_items      INT DEFAULT 0,
    inserted_count   INT DEFAULT 0,
    duplicate_count  INT DEFAULT 0,
    error_count      INT DEFAULT 0,
    error_details    JSONB DEFAULT '[]'::jsonb,
    duration_ms      INT DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mt5_sync_batches_user_id ON public.mt5_sync_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_mt5_sync_batches_connector_id ON public.mt5_sync_batches(connector_id);
CREATE INDEX IF NOT EXISTS idx_mt5_sync_batches_account_id ON public.mt5_sync_batches(account_id);
CREATE INDEX IF NOT EXISTS idx_mt5_sync_batches_created_at ON public.mt5_sync_batches(user_id, created_at DESC);

-- RLS
ALTER TABLE public.mt5_sync_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mt5_sync_batches_select_own" ON public.mt5_sync_batches;
DROP POLICY IF EXISTS "mt5_sync_batches_insert_own" ON public.mt5_sync_batches;

CREATE POLICY "mt5_sync_batches_select_own" ON public.mt5_sync_batches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mt5_sync_batches_insert_own" ON public.mt5_sync_batches FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: EXTEND TRADING_ACCOUNTS WITH MT5 CONNECTOR COLUMNS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS connector_id      UUID REFERENCES public.mt5_connectors(id) ON DELETE SET NULL;
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS mt5_server        TEXT;
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS is_mt5_paired     BOOLEAN DEFAULT false;
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS mt5_login_number TEXT;

CREATE INDEX IF NOT EXISTS idx_trading_accounts_connector_id ON public.trading_accounts(connector_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: EXTEND TRADES WITH MT5 DEAL IDENTIFIERS & TRACEABILITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS connector_id     UUID REFERENCES public.mt5_connectors(id) ON DELETE SET NULL;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS mt5_deal_id      TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS mt5_order_id     TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS mt5_position_id  TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS sync_batch_id    UUID REFERENCES public.mt5_sync_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trades_connector_id ON public.trades(connector_id);
CREATE INDEX IF NOT EXISTS idx_trades_mt5_deal_id ON public.trades(mt5_deal_id);
CREATE INDEX IF NOT EXISTS idx_trades_sync_batch_id ON public.trades(sync_batch_id);

-- Partial Unique Index for Idempotent Deal Ingestion
-- Ensures a user cannot re-insert the same MT5 deal for the same account
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_mt5_dedup
    ON public.trades (user_id, account_id, mt5_deal_id)
    WHERE mt5_deal_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: NOTIFY POSTGREST SCHEMA RELOAD
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
