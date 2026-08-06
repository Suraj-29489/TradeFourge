-- TradeFourge SaaS — Master Reference Schema
-- Target: PostgreSQL / Supabase
-- Version: 5.5.2

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    username TEXT UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    country TEXT DEFAULT 'United States',
    timezone TEXT DEFAULT 'UTC',
    preferred_currency TEXT DEFAULT 'USD',
    preferred_language TEXT DEFAULT 'en',
    trading_experience TEXT DEFAULT 'Intermediate',
    trading_style TEXT DEFAULT 'Day Trader',
    risk_preference TEXT DEFAULT 'Moderate (1-2% / trade)',
    role TEXT DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'support', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. USER PREFERENCES TABLE
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. USER STATISTICS TABLE
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TRADING ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.trading_accounts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_name     TEXT NOT NULL,
    broker           TEXT NOT NULL,
    platform         TEXT DEFAULT 'MetaTrader 5' NOT NULL,
    account_number   TEXT,
    account_type     TEXT DEFAULT 'Live' NOT NULL,
    currency         TEXT DEFAULT 'USD' NOT NULL,
    leverage         TEXT,
    starting_balance NUMERIC(15, 2) DEFAULT 0.00,
    current_balance  NUMERIC(15, 2) DEFAULT 0.00,
    display_id       TEXT UNIQUE,
    slug             TEXT,
    is_default       BOOLEAN DEFAULT false NOT NULL,
    is_active        BOOLEAN DEFAULT true NOT NULL,
    is_archived      BOOLEAN DEFAULT false NOT NULL,
    notes            TEXT,
    last_synced_at   TIMESTAMPTZ,
    sync_interval    INT DEFAULT 60,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TRADE JOURNALS TABLE
CREATE TABLE IF NOT EXISTS public.trade_journals (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    trade_id   UUID REFERENCES public.trades(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    category   TEXT DEFAULT 'General Market Journal' NOT NULL,
    mood       TEXT DEFAULT 'Calm' NOT NULL,
    confidence INT DEFAULT 80 NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    tags       TEXT[] DEFAULT '{}'::text[] NOT NULL,
    session    TEXT,
    strategy   TEXT,
    setup      TEXT,
    word_count INT DEFAULT 0,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TRADES TABLE
CREATE TABLE IF NOT EXISTS public.trades (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id       UUID REFERENCES public.trading_accounts(id) ON DELETE SET NULL,
    ticket           TEXT,
    symbol           TEXT NOT NULL,
    side             TEXT NOT NULL CHECK (side IN ('BUY', 'SELL', 'LONG', 'SHORT')),
    volume           NUMERIC(15, 4) DEFAULT 0 NOT NULL,
    open_price       NUMERIC(15, 6),
    close_price      NUMERIC(15, 6),
    stop_loss        NUMERIC(15, 6),
    take_profit      NUMERIC(15, 6),
    open_time        TIMESTAMPTZ,
    close_time       TIMESTAMPTZ,
    duration_seconds BIGINT,
    profit           NUMERIC(15, 2) DEFAULT 0.00,
    commission       NUMERIC(15, 2) DEFAULT 0.00,
    swap             NUMERIC(15, 2) DEFAULT 0.00,
    taxes            NUMERIC(15, 2) DEFAULT 0.00,
    net_profit       NUMERIC(15, 2) GENERATED ALWAYS AS (profit + commission + swap + taxes) STORED,
    risk_amount      NUMERIC(15, 2),
    reward_amount    NUMERIC(15, 2),
    risk_percent     NUMERIC(8, 4),
    rr_ratio         NUMERIC(8, 4),
    outcome          TEXT CHECK (outcome IN ('WIN', 'LOSS', 'BREAKEVEN', 'OPEN')),
    strategy         TEXT,
    setup            TEXT,
    session          TEXT,
    notes            TEXT,
    emotions         TEXT,
    lessons          TEXT,
    mistakes         TEXT,
    source           TEXT DEFAULT 'manual',
    import_id        UUID,
    magic_number     BIGINT DEFAULT NULL,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TRADE TAGS & LINKS
CREATE TABLE IF NOT EXISTS public.trade_tags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name       TEXT NOT NULL,
    color      TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_tags_user_lower_name ON public.trade_tags(user_id, lower(name));

CREATE TABLE IF NOT EXISTS public.trade_tag_links (
    trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE NOT NULL,
    tag_id   UUID REFERENCES public.trade_tags(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (trade_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.journal_tag_links (
    journal_id UUID REFERENCES public.trade_journals(id) ON DELETE CASCADE NOT NULL,
    tag_id     UUID REFERENCES public.trade_tags(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (journal_id, tag_id)
);

-- 8. CSV IMPORTS TABLE
CREATE TABLE IF NOT EXISTS public.csv_imports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id      UUID REFERENCES public.trading_accounts(id) ON DELETE SET NULL,
    filename        TEXT NOT NULL,
    broker          TEXT,
    platform        TEXT,
    import_status   TEXT DEFAULT 'pending' NOT NULL CHECK (import_status IN ('pending', 'processing', 'success', 'partial', 'failed')),
    total_rows      INT DEFAULT 0,
    imported_rows   INT DEFAULT 0,
    skipped_rows    INT DEFAULT 0,
    duplicate_rows  INT DEFAULT 0,
    failed_rows     INT DEFAULT 0,
    error_log       JSONB,
    notes           TEXT,
    storage_path    TEXT,
    uploaded_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_tag_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_tag_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_imports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "user_preferences_select_own" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_update_own" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_statistics_select_own" ON public.user_statistics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_statistics_insert_own" ON public.user_statistics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_statistics_update_own" ON public.user_statistics FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "accounts_select_own" ON public.trading_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts_insert_own" ON public.trading_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_update_own" ON public.trading_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounts_delete_own" ON public.trading_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "trade_journals_select_own" ON public.trade_journals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "trade_journals_insert_own" ON public.trade_journals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trade_journals_update_own" ON public.trade_journals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "trade_journals_delete_own" ON public.trade_journals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "trades_select_own" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "trades_insert_own" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trades_update_own" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "trades_delete_own" ON public.trades FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "tags_select_own" ON public.trade_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tags_insert_own" ON public.trade_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tags_update_own" ON public.trade_tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tags_delete_own" ON public.trade_tags FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "imports_select_own" ON public.csv_imports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "imports_insert_own" ON public.csv_imports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "imports_update_own" ON public.csv_imports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "imports_delete_own" ON public.csv_imports FOR DELETE USING (auth.uid() = user_id);
