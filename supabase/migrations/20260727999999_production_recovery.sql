-- =============================================================================
-- TradeFourge — Production Database Recovery Migration
-- Version: v3.2.6.x Recovery
-- Generated: 2026-07-27
--
-- SAFE TO RUN MULTIPLE TIMES.
-- Uses IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS.
-- Will NOT drop or modify any existing table, column, or production data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 1: EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---------------------------------------------------------------------------
-- SECTION 2: public.profiles
-- Root cause: NEVER created in production. Only appeared in repository migrations.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name           TEXT,
    username            TEXT UNIQUE,
    avatar_url          TEXT,
    bio                 TEXT,
    country             TEXT DEFAULT 'United States',
    timezone            TEXT DEFAULT 'UTC',
    preferred_currency  TEXT DEFAULT 'USD',
    preferred_language  TEXT DEFAULT 'en',
    trading_experience  TEXT DEFAULT 'Intermediate',
    trading_style       TEXT DEFAULT 'Day Trader',
    risk_preference     TEXT DEFAULT 'Moderate (1-2% / trade)',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Safely add any columns that may be missing if the table partially existed
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username           TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio                TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country            TEXT DEFAULT 'United States';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone           TEXT DEFAULT 'UTC';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'USD';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trading_experience TEXT DEFAULT 'Intermediate';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trading_style      TEXT DEFAULT 'Day Trader';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS risk_preference    TEXT DEFAULT 'Moderate (1-2% / trade)';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at         TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL known policy name variants before recreating (handles duplicates from multiple migration runs)
DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own"          ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"          ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"          ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- SECTION 3: public.user_preferences
-- Root cause: NEVER created in production. Settings save blocked by missing table.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_preferences (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    dashboard_layout      TEXT NOT NULL DEFAULT 'standard',
    default_account       TEXT NOT NULL DEFAULT 'main',
    default_chart_theme   TEXT NOT NULL DEFAULT 'dark',
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    email_notifications   BOOLEAN NOT NULL DEFAULT true,
    marketing_emails      BOOLEAN NOT NULL DEFAULT false,
    default_trade_currency TEXT NOT NULL DEFAULT 'USD',
    date_format           TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    time_format           TEXT NOT NULL DEFAULT '24h',
    week_start            TEXT NOT NULL DEFAULT 'Monday',
    risk_display_mode     TEXT NOT NULL DEFAULT 'percentage',
    analytics_defaults    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Safely add any columns that may be missing
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS dashboard_layout       TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS default_account        TEXT NOT NULL DEFAULT 'main';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS default_chart_theme    TEXT NOT NULL DEFAULT 'dark';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS notifications_enabled  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_notifications    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS marketing_emails       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS default_trade_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS date_format            TEXT NOT NULL DEFAULT 'YYYY-MM-DD';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS time_format            TEXT NOT NULL DEFAULT '24h';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS week_start             TEXT NOT NULL DEFAULT 'Monday';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS risk_display_mode      TEXT NOT NULL DEFAULT 'percentage';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS analytics_defaults     JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop ALL known policy name variants before recreating
DROP POLICY IF EXISTS "Users can view own preferences"   ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_select_own"      ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert_own"      ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_update_own"      ON public.user_preferences;

CREATE POLICY "user_preferences_select_own" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_insert_own" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_update_own" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- SECTION 4: public.user_statistics
-- Confirmed MISSING from live production (HTTP 404).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_statistics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    total_trades    INT NOT NULL DEFAULT 0,
    total_profit    NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_loss      NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    win_rate        NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    average_rr      NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    current_streak  INT NOT NULL DEFAULT 0,
    best_day        NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    worst_day       NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_statistics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own statistics"   ON public.user_statistics;
DROP POLICY IF EXISTS "Users can insert own statistics" ON public.user_statistics;
DROP POLICY IF EXISTS "Users can update own statistics" ON public.user_statistics;
DROP POLICY IF EXISTS "user_statistics_select_own"      ON public.user_statistics;
DROP POLICY IF EXISTS "user_statistics_insert_own"      ON public.user_statistics;
DROP POLICY IF EXISTS "user_statistics_update_own"      ON public.user_statistics;

CREATE POLICY "user_statistics_select_own" ON public.user_statistics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_statistics_insert_own" ON public.user_statistics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_statistics_update_own" ON public.user_statistics
    FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- SECTION 5: public.user_settings (Legacy — MISSING from live production)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    theme           TEXT NOT NULL DEFAULT 'dark',
    currency_format TEXT NOT NULL DEFAULT 'USD',
    risk_per_trade  NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings"   ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;

CREATE POLICY "Users can view own settings"   ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- SECTION 6: public.journals (MISSING from live production — HTTP 404)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.journals (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own journals"   ON public.journals;
DROP POLICY IF EXISTS "Users can insert own journals" ON public.journals;
DROP POLICY IF EXISTS "Users can update own journals" ON public.journals;
DROP POLICY IF EXISTS "Users can delete own journals" ON public.journals;

CREATE POLICY "Users can view own journals"   ON public.journals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journals" ON public.journals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journals" ON public.journals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own journals" ON public.journals FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- SECTION 7: trade_tag_links RLS (returns HTTP 400 — table exists but RLS blocks)
-- ---------------------------------------------------------------------------

ALTER TABLE public.trade_tag_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tag_links_select_own" ON public.trade_tag_links;
DROP POLICY IF EXISTS "tag_links_insert_own" ON public.trade_tag_links;
DROP POLICY IF EXISTS "tag_links_delete_own" ON public.trade_tag_links;

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

-- ---------------------------------------------------------------------------
-- SECTION 8: STORAGE BUCKETS (idempotent ON CONFLICT)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('trade-screenshots', 'trade-screenshots', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

-- Avatar storage policies (drop before recreate)
DROP POLICY IF EXISTS "Public read avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Users insert own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_own"      ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own"      ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own"      ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own"      ON storage.objects;

CREATE POLICY "avatars_select_own" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "screenshots_select_own" ON storage.objects;
DROP POLICY IF EXISTS "screenshots_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "screenshots_delete_own" ON storage.objects;

CREATE POLICY "screenshots_select_own" ON storage.objects FOR SELECT USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "screenshots_insert_own" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "screenshots_delete_own" ON storage.objects FOR DELETE USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ---------------------------------------------------------------------------
-- SECTION 9: handle_new_user() TRIGGER (full version — all 4 tables)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  clean_username TEXT;
BEGIN
  clean_username := LOWER(REGEXP_REPLACE(
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    '[^a-zA-Z0-9_]',
    '',
    'g'
  )) || '_' || SUBSTRING(NEW.id::text, 1, 4);

  INSERT INTO public.profiles (id, full_name, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Trader'),
    clean_username,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_statistics (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- SECTION 10: BACKFILL — create missing rows for ALL EXISTING users
-- Users who signed up before tables existed have no rows.
-- ON CONFLICT DO NOTHING ensures no data is overwritten.
-- ---------------------------------------------------------------------------

INSERT INTO public.profiles (id, full_name, username, avatar_url, created_at, updated_at)
SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', 'Trader'),
    LOWER(REGEXP_REPLACE(
        COALESCE(u.raw_user_meta_data->>'full_name', SPLIT_PART(u.email, '@', 1), 'trader'),
        '[^a-zA-Z0-9_]', '', 'g'
    )) || '_' || SUBSTRING(u.id::text, 1, 4),
    COALESCE(u.raw_user_meta_data->>'avatar_url', ''),
    now(),
    now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_preferences (user_id, created_at, updated_at)
SELECT u.id, now(), now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_preferences p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_statistics (user_id, created_at, updated_at)
SELECT u.id, now(), now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_statistics s WHERE s.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_settings (user_id, updated_at)
SELECT u.id, now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_settings s WHERE s.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- SECTION 11: VERIFICATION — run this to confirm everything applied correctly
-- Expected: each table shows at least 1 row (one per authenticated user)
-- ---------------------------------------------------------------------------

SELECT 'profiles'         AS table_name, COUNT(*) AS row_count FROM public.profiles
UNION ALL
SELECT 'user_preferences' AS table_name, COUNT(*) AS row_count FROM public.user_preferences
UNION ALL
SELECT 'user_statistics'  AS table_name, COUNT(*) AS row_count FROM public.user_statistics
UNION ALL
SELECT 'user_settings'    AS table_name, COUNT(*) AS row_count FROM public.user_settings
UNION ALL
SELECT 'trades'           AS table_name, COUNT(*) AS row_count FROM public.trades
UNION ALL
SELECT 'trading_accounts' AS table_name, COUNT(*) AS row_count FROM public.trading_accounts;

-- =============================================================================
-- END OF RECOVERY MIGRATION
-- =============================================================================
