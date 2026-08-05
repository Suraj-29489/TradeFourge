-- =============================================================================
-- TradeFourge Phase 3.0 — Cloud Foundation Migration
-- Version: 3.0.0
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fast text search

-- =============================================================================
-- 1. TRADING ACCOUNTS (expanded from v2)
-- =============================================================================

-- Drop old minimal table (safe because Phase 3.0 is pre-production data)
DROP TABLE IF EXISTS public.trading_accounts CASCADE;

CREATE TABLE public.trading_accounts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_name     TEXT NOT NULL,
    broker           TEXT NOT NULL,
    platform         TEXT NOT NULL DEFAULT 'MetaTrader 5'
                     CHECK (platform IN ('MetaTrader 4', 'MetaTrader 5', 'cTrader', 'DXTrade', 'TradeLocker', 'Exness Terminal', 'Other')),
    account_number   TEXT,
    account_type     TEXT NOT NULL DEFAULT 'Live'
                     CHECK (account_type IN ('Live', 'Demo', 'Prop', 'Contest')),
    currency         TEXT NOT NULL DEFAULT 'USD',
    leverage         TEXT,
    starting_balance NUMERIC(15, 2) DEFAULT 0.00,
    current_balance  NUMERIC(15, 2) DEFAULT 0.00,
    is_default       BOOLEAN NOT NULL DEFAULT false,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_trading_accounts_user_id ON public.trading_accounts(user_id);
CREATE INDEX idx_trading_accounts_is_default ON public.trading_accounts(user_id, is_default) WHERE is_default = true;

-- RLS
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_select_own" ON public.trading_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "accounts_insert_own" ON public.trading_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_update_own" ON public.trading_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "accounts_delete_own" ON public.trading_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 2. TRADES (full production schema)
-- =============================================================================

DROP TABLE IF EXISTS public.trades CASCADE;

CREATE TABLE public.trades (
    -- ── Identity ────────────────────────────────────────────────────────────
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id       UUID REFERENCES public.trading_accounts(id) ON DELETE SET NULL,
    ticket           TEXT,                          -- Broker position ID / ticket

    -- ── Trade Core ──────────────────────────────────────────────────────────
    symbol           TEXT NOT NULL,
    side             TEXT NOT NULL CHECK (side IN ('BUY', 'SELL', 'LONG', 'SHORT')),
    volume           NUMERIC(15, 4) NOT NULL DEFAULT 0,   -- Lot size

    -- ── Prices ──────────────────────────────────────────────────────────────
    open_price       NUMERIC(15, 6),
    close_price      NUMERIC(15, 6),
    stop_loss        NUMERIC(15, 6),
    take_profit      NUMERIC(15, 6),

    -- ── Time ────────────────────────────────────────────────────────────────
    open_time        TIMESTAMPTZ,
    close_time       TIMESTAMPTZ,
    duration_seconds BIGINT,                       -- Calculated hold duration

    -- ── Financial ───────────────────────────────────────────────────────────
    profit           NUMERIC(15, 2) DEFAULT 0.00,  -- Raw broker profit (USD)
    commission       NUMERIC(15, 2) DEFAULT 0.00,
    swap             NUMERIC(15, 2) DEFAULT 0.00,
    taxes            NUMERIC(15, 2) DEFAULT 0.00,
    net_profit       NUMERIC(15, 2) GENERATED ALWAYS AS
                     (profit + commission + swap + taxes) STORED,

    -- ── Risk ────────────────────────────────────────────────────────────────
    risk_amount      NUMERIC(15, 2),               -- $ at risk
    reward_amount    NUMERIC(15, 2),               -- $ potential reward
    risk_percent     NUMERIC(8, 4),                -- % of account at risk
    rr_ratio         NUMERIC(8, 4),                -- Actual R:R achieved

    -- ── Performance ─────────────────────────────────────────────────────────
    pips             NUMERIC(10, 2),
    outcome          TEXT CHECK (outcome IN ('WIN', 'LOSS', 'BREAKEVEN', 'OPEN')),
    mfe              NUMERIC(15, 2),               -- Maximum Favorable Excursion
    mae              NUMERIC(15, 2),               -- Maximum Adverse Excursion

    -- ── Journal / Notes ──────────────────────────────────────────────────────
    strategy         TEXT,
    setup            TEXT,
    market_condition TEXT,
    session          TEXT CHECK (session IN ('London', 'New York', 'Tokyo', 'Sydney', 'London/NY Overlap', 'Other', NULL)),
    notes            TEXT,
    emotions         TEXT,
    lessons          TEXT,
    mistakes         TEXT,
    confidence_rating SMALLINT CHECK (confidence_rating BETWEEN 1 AND 10),

    -- ── Media ────────────────────────────────────────────────────────────────
    screenshot_url   TEXT,
    chart_url        TEXT,

    -- ── Import Metadata ──────────────────────────────────────────────────────
    source           TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'csv_import', 'api')),
    import_id        UUID,                         -- References csv_imports.id
    imported_at      TIMESTAMPTZ,

    -- ── Timestamps ───────────────────────────────────────────────────────────
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_trades_user_id      ON public.trades(user_id);
CREATE INDEX idx_trades_account_id   ON public.trades(account_id);
CREATE INDEX idx_trades_close_time   ON public.trades(user_id, close_time DESC);
CREATE INDEX idx_trades_open_time    ON public.trades(user_id, open_time DESC);
CREATE INDEX idx_trades_symbol       ON public.trades(user_id, symbol);
CREATE INDEX idx_trades_outcome      ON public.trades(user_id, outcome);
CREATE INDEX idx_trades_source       ON public.trades(user_id, source);
CREATE INDEX idx_trades_ticket       ON public.trades(user_id, ticket);
-- Full-text search on symbol + notes + strategy
CREATE INDEX idx_trades_search       ON public.trades USING gin(
    to_tsvector('english', coalesce(symbol, '') || ' ' || coalesce(notes, '') || ' ' || coalesce(strategy, '') || ' ' || coalesce(ticket, ''))
);

-- RLS
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trades_select_own" ON public.trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "trades_insert_own" ON public.trades
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trades_update_own" ON public.trades
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "trades_delete_own" ON public.trades
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 3. TRADE TAGS — User tag pool
-- =============================================================================

DROP TABLE IF EXISTS public.trade_tag_links CASCADE;
DROP TABLE IF EXISTS public.trade_tags CASCADE;

CREATE TABLE public.trade_tags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT DEFAULT '#8b5cf6',   -- hex color
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);

CREATE INDEX idx_trade_tags_user_id ON public.trade_tags(user_id);

ALTER TABLE public.trade_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_own" ON public.trade_tags
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "tags_insert_own" ON public.trade_tags
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags_update_own" ON public.trade_tags
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "tags_delete_own" ON public.trade_tags
    FOR DELETE USING (auth.uid() = user_id);

-- Many-to-many link table
CREATE TABLE public.trade_tag_links (
    trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
    tag_id   UUID NOT NULL REFERENCES public.trade_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, tag_id)
);

CREATE INDEX idx_trade_tag_links_trade_id ON public.trade_tag_links(trade_id);
CREATE INDEX idx_trade_tag_links_tag_id   ON public.trade_tag_links(tag_id);

ALTER TABLE public.trade_tag_links ENABLE ROW LEVEL SECURITY;

-- Scoped via JOIN to trades
CREATE POLICY "tag_links_select_own" ON public.trade_tag_links
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.trades WHERE id = trade_id AND user_id = auth.uid())
    );

CREATE POLICY "tag_links_insert_own" ON public.trade_tag_links
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.trades WHERE id = trade_id AND user_id = auth.uid())
    );

CREATE POLICY "tag_links_delete_own" ON public.trade_tag_links
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.trades WHERE id = trade_id AND user_id = auth.uid())
    );

-- =============================================================================
-- 4. TRADE IMAGES — Multiple images per trade
-- =============================================================================

DROP TABLE IF EXISTS public.trade_images CASCADE;

CREATE TABLE public.trade_images (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trade_id     UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
    image_type   TEXT NOT NULL DEFAULT 'screenshot'
                 CHECK (image_type IN ('entry', 'exit', 'chart', 'analysis', 'screenshot', 'other')),
    storage_path TEXT NOT NULL,            -- Supabase Storage path
    public_url   TEXT NOT NULL,            -- Public URL for display
    caption      TEXT,
    file_size    BIGINT,                   -- bytes
    width        INT,
    height       INT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trade_images_trade_id ON public.trade_images(trade_id);
CREATE INDEX idx_trade_images_user_id  ON public.trade_images(user_id);

ALTER TABLE public.trade_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "images_select_own" ON public.trade_images
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "images_insert_own" ON public.trade_images
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "images_delete_own" ON public.trade_images
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 5. TRADE CHECKLISTS — Reusable templates + per-trade completions
-- =============================================================================

DROP TABLE IF EXISTS public.trade_checklist_completions CASCADE;
DROP TABLE IF EXISTS public.trade_checklist_items CASCADE;
DROP TABLE IF EXISTS public.trade_checklists CASCADE;

-- Checklist template
CREATE TABLE public.trade_checklists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trade_checklists_user_id ON public.trade_checklists(user_id);

ALTER TABLE public.trade_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklists_select_own" ON public.trade_checklists
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "checklists_insert_own" ON public.trade_checklists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "checklists_update_own" ON public.trade_checklists
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "checklists_delete_own" ON public.trade_checklists
    FOR DELETE USING (auth.uid() = user_id);

-- Checklist items (template items)
CREATE TABLE public.trade_checklist_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID NOT NULL REFERENCES public.trade_checklists(id) ON DELETE CASCADE,
    text         TEXT NOT NULL,
    sort_order   INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_items_checklist_id ON public.trade_checklist_items(checklist_id);

ALTER TABLE public.trade_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_items_select_own" ON public.trade_checklist_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.trade_checklists WHERE id = checklist_id AND user_id = auth.uid())
    );

CREATE POLICY "checklist_items_insert_own" ON public.trade_checklist_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.trade_checklists WHERE id = checklist_id AND user_id = auth.uid())
    );

CREATE POLICY "checklist_items_update_own" ON public.trade_checklist_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.trade_checklists WHERE id = checklist_id AND user_id = auth.uid())
    );

CREATE POLICY "checklist_items_delete_own" ON public.trade_checklist_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.trade_checklists WHERE id = checklist_id AND user_id = auth.uid())
    );

-- Per-trade completion records
CREATE TABLE public.trade_checklist_completions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id         UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES public.trade_checklist_items(id) ON DELETE CASCADE,
    is_checked       BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (trade_id, checklist_item_id)
);

CREATE INDEX idx_completions_trade_id ON public.trade_checklist_completions(trade_id);

ALTER TABLE public.trade_checklist_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "completions_select_own" ON public.trade_checklist_completions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.trades WHERE id = trade_id AND user_id = auth.uid())
    );

CREATE POLICY "completions_insert_own" ON public.trade_checklist_completions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.trades WHERE id = trade_id AND user_id = auth.uid())
    );

CREATE POLICY "completions_update_own" ON public.trade_checklist_completions
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.trades WHERE id = trade_id AND user_id = auth.uid())
    );

CREATE POLICY "completions_delete_own" ON public.trade_checklist_completions
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.trades WHERE id = trade_id AND user_id = auth.uid())
    );

-- =============================================================================
-- 6. CSV IMPORTS — Full import tracking
-- =============================================================================

DROP TABLE IF EXISTS public.csv_imports CASCADE;

CREATE TABLE public.csv_imports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id      UUID REFERENCES public.trading_accounts(id) ON DELETE SET NULL,
    filename        TEXT NOT NULL,
    broker          TEXT,
    platform        TEXT,
    import_status   TEXT NOT NULL DEFAULT 'pending'
                    CHECK (import_status IN ('pending', 'processing', 'success', 'partial', 'failed')),
    total_rows      INT DEFAULT 0,
    imported_rows   INT DEFAULT 0,
    skipped_rows    INT DEFAULT 0,
    duplicate_rows  INT DEFAULT 0,
    failed_rows     INT DEFAULT 0,
    error_log       JSONB,                          -- Array of error strings
    notes           TEXT,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_csv_imports_user_id ON public.csv_imports(user_id);
CREATE INDEX idx_csv_imports_uploaded_at ON public.csv_imports(user_id, uploaded_at DESC);
CREATE INDEX idx_csv_imports_status ON public.csv_imports(user_id, import_status);

ALTER TABLE public.csv_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imports_select_own" ON public.csv_imports
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "imports_insert_own" ON public.csv_imports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "imports_update_own" ON public.csv_imports
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "imports_delete_own" ON public.csv_imports
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 7. STORAGE BUCKETS
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'trade-screenshots',
    'trade-screenshots',
    true,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760;

-- Storage RLS policies for trade-screenshots bucket
CREATE POLICY "screenshots_select_own"
ON storage.objects FOR SELECT
USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "screenshots_insert_own"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "screenshots_delete_own"
ON storage.objects FOR DELETE
USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================================================
-- 8. UPDATED_AT TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trading_accounts_updated_at
    BEFORE UPDATE ON public.trading_accounts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trades_updated_at
    BEFORE UPDATE ON public.trades
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER checklists_updated_at
    BEFORE UPDATE ON public.trade_checklists
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER csv_imports_updated_at
    BEFORE UPDATE ON public.csv_imports
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- 9. USEFUL VIEWS (no additional permissions needed — inherit from base tables)
-- =============================================================================

-- Trades with tag names denormalized (used for export / analytics)
CREATE OR REPLACE VIEW public.trades_with_tags AS
SELECT
    t.*,
    COALESCE(
        array_agg(tt.name ORDER BY tt.name) FILTER (WHERE tt.name IS NOT NULL),
        ARRAY[]::TEXT[]
    ) AS tag_names
FROM public.trades t
LEFT JOIN public.trade_tag_links ttl ON ttl.trade_id = t.id
LEFT JOIN public.trade_tags tt ON tt.id = ttl.tag_id
GROUP BY t.id;

-- =============================================================================
-- 10. USER PROFILES, PREFERENCES & STATISTICS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    username TEXT UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    country TEXT DEFAULT 'United States',
    timezone TEXT DEFAULT 'UTC',
    preferred_currency TEXT DEFAULT 'USD',
    preferred_language TEXT DEFAULT 'en',
    trading_experience TEXT DEFAULT 'Intermediate',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    dashboard_layout TEXT DEFAULT 'standard' NOT NULL,
    default_account TEXT DEFAULT 'main' NOT NULL,
    default_chart_theme TEXT DEFAULT 'dark' NOT NULL,
    notifications_enabled BOOLEAN DEFAULT true NOT NULL,
    email_notifications BOOLEAN DEFAULT true NOT NULL,
    marketing_emails BOOLEAN DEFAULT false NOT NULL,
    default_trade_currency TEXT DEFAULT 'USD' NOT NULL,
    date_format TEXT DEFAULT 'YYYY-MM-DD' NOT NULL,
    time_format TEXT DEFAULT '24h' NOT NULL,
    week_start TEXT DEFAULT 'Monday' NOT NULL,
    risk_display_mode TEXT DEFAULT 'percentage' NOT NULL,
    analytics_defaults JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_own" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_update_own" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    total_trades INT DEFAULT 0 NOT NULL,
    total_profit NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    total_loss NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    win_rate NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    average_rr NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    current_streak INT DEFAULT 0 NOT NULL,
    best_day NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    worst_day NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_statistics_select_own" ON public.user_statistics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_statistics_insert_own" ON public.user_statistics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_statistics_update_own" ON public.user_statistics FOR UPDATE USING (auth.uid() = user_id);

-- Avatars Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "avatars_select_own" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
