-- =============================================================================
-- TradeFourge v5.5.2 — Master Database Schema Synchronization & Persistence Migration
-- Target: Supabase PostgreSQL Database
-- Version: v5.5.2 Production Release
-- Safe to execute multiple times (IDEMPOTENT with IF NOT EXISTS & DROP POLICY IF EXISTS).
-- =============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: TRADING ACCOUNTS SCHEMA SYNCHRONIZATION
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trading_accounts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_name     TEXT NOT NULL,
    broker           TEXT NOT NULL,
    platform         TEXT NOT NULL DEFAULT 'MetaTrader 5',
    account_number   TEXT,
    account_type     TEXT NOT NULL DEFAULT 'Live',
    currency         TEXT NOT NULL DEFAULT 'USD',
    leverage         TEXT,
    starting_balance NUMERIC(15, 2) DEFAULT 0.00,
    current_balance  NUMERIC(15, 2) DEFAULT 0.00,
    is_default       BOOLEAN NOT NULL DEFAULT false,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Add missing columns safely
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS display_id     TEXT;
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS slug           TEXT;
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS is_archived   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE public.trading_accounts ADD COLUMN IF NOT EXISTS sync_interval INT DEFAULT 60;

-- Backfill missing display_id for existing rows
UPDATE public.trading_accounts 
SET display_id = 'TF-ACC-' || upper(substring(md5(random()::text || id::text) from 1 for 8))
WHERE display_id IS NULL;

-- Backfill missing slug for existing rows
UPDATE public.trading_accounts 
SET slug = lower(regexp_replace(account_name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Enforce UNIQUE constraint on display_id if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'trading_accounts_display_id_key'
    ) THEN
        ALTER TABLE public.trading_accounts ADD CONSTRAINT trading_accounts_display_id_key UNIQUE (display_id);
    END IF;
END $$;

-- Trigger to prevent display_id modification (immutable identity)
CREATE OR REPLACE FUNCTION public.prevent_display_id_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.display_id IS NOT NULL AND NEW.display_id IS DISTINCT FROM OLD.display_id THEN
        RAISE EXCEPTION 'display_id is immutable and cannot be changed after creation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_display_id_change ON public.trading_accounts;
CREATE TRIGGER trg_prevent_display_id_change
    BEFORE UPDATE ON public.trading_accounts
    FOR EACH ROW EXECUTE FUNCTION public.prevent_display_id_change();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON public.trading_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_display_id ON public.trading_accounts(display_id);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_is_default ON public.trading_accounts(user_id, is_default) WHERE is_default = true;

-- Enable RLS & Policies
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounts_select_own" ON public.trading_accounts;
DROP POLICY IF EXISTS "accounts_insert_own" ON public.trading_accounts;
DROP POLICY IF EXISTS "accounts_update_own" ON public.trading_accounts;
DROP POLICY IF EXISTS "accounts_delete_own" ON public.trading_accounts;

CREATE POLICY "accounts_select_own" ON public.trading_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts_insert_own" ON public.trading_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_update_own" ON public.trading_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounts_delete_own" ON public.trading_accounts FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: TRADE JOURNALS SCHEMA RECONSTRUCTION & PERSISTENCE
-- ─────────────────────────────────────────────────────────────────────────────

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
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all expected columns exist on trade_journals
ALTER TABLE public.trade_journals ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.trade_journals ADD COLUMN IF NOT EXISTS strategy   TEXT;
ALTER TABLE public.trade_journals ADD COLUMN IF NOT EXISTS setup      TEXT;
ALTER TABLE public.trade_journals ADD COLUMN IF NOT EXISTS word_count INT DEFAULT 0;
ALTER TABLE public.trade_journals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_trade_journals_user_id ON public.trade_journals(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_journals_trade_id ON public.trade_journals(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_journals_account_id ON public.trade_journals(account_id);
CREATE INDEX IF NOT EXISTS idx_trade_journals_created_at ON public.trade_journals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_journals_tags ON public.trade_journals USING gin(tags);

-- Enable RLS & Policies
ALTER TABLE public.trade_journals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own trade journals"   ON public.trade_journals;
DROP POLICY IF EXISTS "Users can insert own trade journals" ON public.trade_journals;
DROP POLICY IF EXISTS "Users can update own trade journals" ON public.trade_journals;
DROP POLICY IF EXISTS "Users can delete own trade journals" ON public.trade_journals;

CREATE POLICY "Users can view own trade journals"   ON public.trade_journals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trade journals" ON public.trade_journals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trade journals" ON public.trade_journals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trade journals" ON public.trade_journals FOR DELETE USING (auth.uid() = user_id);

-- Legacy Compatibility View for queries pointing to public.journals
CREATE OR REPLACE VIEW public.v_journals AS
SELECT id, user_id, title AS name, content AS description, created_at
FROM public.trade_journals;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: TAG SYSTEM PERSISTENCE & NORMALIZATION
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_tags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Case-insensitive unique index per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_tags_user_lower_name ON public.trade_tags(user_id, lower(name));

-- Trade Tag Links
CREATE TABLE IF NOT EXISTS public.trade_tag_links (
    trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
    tag_id   UUID NOT NULL REFERENCES public.trade_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, tag_id)
);

-- Journal Tag Links
CREATE TABLE IF NOT EXISTS public.journal_tag_links (
    journal_id UUID NOT NULL REFERENCES public.trade_journals(id) ON DELETE CASCADE,
    tag_id     UUID NOT NULL REFERENCES public.trade_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (journal_id, tag_id)
);

-- RLS & Policies for Tags
ALTER TABLE public.trade_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_tag_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_tag_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_select_own" ON public.trade_tags;
DROP POLICY IF EXISTS "tags_insert_own" ON public.trade_tags;
DROP POLICY IF EXISTS "tags_update_own" ON public.trade_tags;
DROP POLICY IF EXISTS "tags_delete_own" ON public.trade_tags;

CREATE POLICY "tags_select_own" ON public.trade_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tags_insert_own" ON public.trade_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tags_update_own" ON public.trade_tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tags_delete_own" ON public.trade_tags FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tag_links_select_own" ON public.trade_tag_links;
DROP POLICY IF EXISTS "tag_links_insert_own" ON public.trade_tag_links;
DROP POLICY IF EXISTS "tag_links_delete_own" ON public.trade_tag_links;

CREATE POLICY "tag_links_select_own" ON public.trade_tag_links FOR SELECT USING (EXISTS (SELECT 1 FROM public.trades WHERE id = trade_id AND user_id = auth.uid()));
CREATE POLICY "tag_links_insert_own" ON public.trade_tag_links FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.trades WHERE id = trade_id AND user_id = auth.uid()));
CREATE POLICY "tag_links_delete_own" ON public.trade_tag_links FOR DELETE USING (EXISTS (SELECT 1 FROM public.trades WHERE id = trade_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "journal_tag_links_select_own" ON public.journal_tag_links;
DROP POLICY IF EXISTS "journal_tag_links_insert_own" ON public.journal_tag_links;
DROP POLICY IF EXISTS "journal_tag_links_delete_own" ON public.journal_tag_links;

CREATE POLICY "journal_tag_links_select_own" ON public.journal_tag_links FOR SELECT USING (EXISTS (SELECT 1 FROM public.trade_journals WHERE id = journal_id AND user_id = auth.uid()));
CREATE POLICY "journal_tag_links_insert_own" ON public.journal_tag_links FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.trade_journals WHERE id = journal_id AND user_id = auth.uid()));
CREATE POLICY "journal_tag_links_delete_own" ON public.journal_tag_links FOR DELETE USING (EXISTS (SELECT 1 FROM public.trade_journals WHERE id = journal_id AND user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: TRADES & ACCOUNT LINKING MIGRATION (ORPHAN TRADES FIX)
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure foreign key constraint exists from trades to trading_accounts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'trades_account_id_fkey'
    ) THEN
        ALTER TABLE public.trades 
        ADD CONSTRAINT trades_account_id_fkey 
        FOREIGN KEY (account_id) REFERENCES public.trading_accounts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Data Migration Function: Backfill orphan trades without account_id
DO $$
DECLARE
    rec RECORD;
    target_acc_id UUID;
BEGIN
    FOR rec IN SELECT DISTINCT user_id FROM public.trades WHERE account_id IS NULL LOOP
        -- 1. Try default account
        SELECT id INTO target_acc_id FROM public.trading_accounts WHERE user_id = rec.user_id AND is_default = true LIMIT 1;
        
        -- 2. If no default, pick oldest active account
        IF target_acc_id IS NULL THEN
            SELECT id INTO target_acc_id FROM public.trading_accounts WHERE user_id = rec.user_id AND is_active = true ORDER BY created_at ASC LIMIT 1;
        END IF;

        -- 3. If user has NO accounts at all, auto-create a default account for them
        IF target_acc_id IS NULL THEN
            INSERT INTO public.trading_accounts (user_id, account_name, broker, platform, currency, display_id, is_default)
            VALUES (rec.user_id, 'Primary Trading Account', 'Generic Broker', 'MetaTrader 5', 'USD', 'TF-ACC-MAIN01', true)
            RETURNING id INTO target_acc_id;
        END IF;

        -- Link all orphan trades for this user to target_acc_id
        UPDATE public.trades SET account_id = target_acc_id WHERE user_id = rec.user_id AND account_id IS NULL;
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: CSV IMPORT HISTORY PERSISTENCE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.csv_imports (
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
    error_log       JSONB,
    notes           TEXT,
    storage_path    TEXT,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.csv_imports ADD COLUMN IF NOT EXISTS account_id   UUID REFERENCES public.trading_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.csv_imports ADD COLUMN IF NOT EXISTS storage_path TEXT;

CREATE INDEX IF NOT EXISTS idx_csv_imports_user_id ON public.csv_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_csv_imports_account_id ON public.csv_imports(account_id);
CREATE INDEX IF NOT EXISTS idx_csv_imports_uploaded_at ON public.csv_imports(user_id, uploaded_at DESC);

ALTER TABLE public.csv_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imports_select_own" ON public.csv_imports;
DROP POLICY IF EXISTS "imports_insert_own" ON public.csv_imports;
DROP POLICY IF EXISTS "imports_update_own" ON public.csv_imports;
DROP POLICY IF EXISTS "imports_delete_own" ON public.csv_imports;

CREATE POLICY "imports_select_own" ON public.csv_imports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "imports_insert_own" ON public.csv_imports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "imports_update_own" ON public.csv_imports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "imports_delete_own" ON public.csv_imports FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: AUTOMATED TIMESTAMP UPDATER TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_trading_accounts_timestamp ON public.trading_accounts;
CREATE TRIGGER trg_update_trading_accounts_timestamp
    BEFORE UPDATE ON public.trading_accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_trade_journals_timestamp ON public.trade_journals;
CREATE TRIGGER trg_update_trade_journals_timestamp
    BEFORE UPDATE ON public.trade_journals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_trades_timestamp ON public.trades;
CREATE TRIGGER trg_update_trades_timestamp
    BEFORE UPDATE ON public.trades
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_csv_imports_timestamp ON public.csv_imports;
CREATE TRIGGER trg_update_csv_imports_timestamp
    BEFORE UPDATE ON public.csv_imports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
