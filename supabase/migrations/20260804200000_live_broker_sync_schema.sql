-- =============================================================================
-- TradeFourge v4.0.0 — Live Broker Sync Complete Schema Migration
-- Migration File: 20260804200000_live_broker_sync_schema.sql
-- =============================================================================

-- 1. LIVE BROKER CREDENTIALS TABLE
CREATE TABLE IF NOT EXISTS public.live_broker_credentials (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id           UUID REFERENCES public.trading_accounts(id) ON DELETE SET NULL,
    broker               TEXT NOT NULL,
    platform             TEXT NOT NULL DEFAULT 'MetaTrader 5',
    account_name         TEXT NOT NULL,
    account_number       TEXT NOT NULL,
    server               TEXT NOT NULL,
    encrypted_password   TEXT NOT NULL,
    status               TEXT NOT NULL DEFAULT 'Connected'
                         CHECK (status IN ('Connected', 'Disconnected', 'Syncing', 'Authentication Failed', 'Invalid Server', 'Server Offline', 'Error')),
    last_sync            TIMESTAMPTZ,
    auto_sync            BOOLEAN NOT NULL DEFAULT true,
    last_imported_ticket TEXT,
    last_closed_time     TIMESTAMPTZ,
    total_trades         INT NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for Live Broker Credentials
CREATE INDEX IF NOT EXISTS idx_live_broker_credentials_user_id 
ON public.live_broker_credentials(user_id);

CREATE INDEX IF NOT EXISTS idx_live_broker_credentials_account_id 
ON public.live_broker_credentials(account_id);

-- RLS Policies for Live Broker Credentials
ALTER TABLE public.live_broker_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credentials_select_own" ON public.live_broker_credentials;
CREATE POLICY "credentials_select_own" ON public.live_broker_credentials
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "credentials_insert_own" ON public.live_broker_credentials;
CREATE POLICY "credentials_insert_own" ON public.live_broker_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "credentials_update_own" ON public.live_broker_credentials;
CREATE POLICY "credentials_update_own" ON public.live_broker_credentials
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "credentials_delete_own" ON public.live_broker_credentials;
CREATE POLICY "credentials_delete_own" ON public.live_broker_credentials
    FOR DELETE USING (auth.uid() = user_id);

-- 2. SYNC HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.sync_history (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id      UUID REFERENCES public.live_broker_credentials(id) ON DELETE CASCADE,
    account_id         UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
    broker             TEXT NOT NULL,
    account_name       TEXT NOT NULL,
    sync_time          TIMESTAMPTZ NOT NULL DEFAULT now(),
    trades_imported    INT NOT NULL DEFAULT 0,
    duplicates_skipped INT NOT NULL DEFAULT 0,
    duration_ms        INT NOT NULL DEFAULT 0,
    status             TEXT NOT NULL CHECK (status IN ('SUCCESS', 'WARNING', 'FAILED')),
    error_message      TEXT,
    log_details        JSONB DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for Sync History
CREATE INDEX IF NOT EXISTS idx_sync_history_user_id 
ON public.sync_history(user_id);

CREATE INDEX IF NOT EXISTS idx_sync_history_sync_time 
ON public.sync_history(user_id, sync_time DESC);

-- RLS Policies for Sync History
ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_history_select_own" ON public.sync_history;
CREATE POLICY "sync_history_select_own" ON public.sync_history
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sync_history_insert_own" ON public.sync_history;
CREATE POLICY "sync_history_insert_own" ON public.sync_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sync_history_delete_own" ON public.sync_history;
CREATE POLICY "sync_history_delete_own" ON public.sync_history
    FOR DELETE USING (auth.uid() = user_id);
