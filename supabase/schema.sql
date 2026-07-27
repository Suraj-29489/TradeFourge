-- TradeFourge SaaS — Master Reference Schema
-- Target: PostgreSQL / Supabase
-- Version: 2.5.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    broker TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT,
    currency TEXT DEFAULT 'USD' NOT NULL,
    balance NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. JOURNALS TABLE
CREATE TABLE IF NOT EXISTS public.journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TRADES TABLE
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    journal_id UUID REFERENCES public.journals(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL', 'LONG', 'SHORT')),
    entry_price NUMERIC(15, 5) NOT NULL,
    exit_price NUMERIC(15, 5),
    quantity NUMERIC(15, 4) NOT NULL,
    pnl NUMERIC(15, 2),
    status TEXT DEFAULT 'OPEN' NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    magic_number BIGINT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TRADE IMAGES TABLE
CREATE TABLE IF NOT EXISTS public.trade_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. USER SETTINGS TABLE (LEGACY COMPATIBILITY)
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    theme TEXT DEFAULT 'dark' NOT NULL,
    currency_format TEXT DEFAULT 'USD' NOT NULL,
    risk_per_trade NUMERIC(5, 2) DEFAULT 1.00 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Preferences RLS
CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Statistics RLS
CREATE POLICY "Users can view own statistics" ON public.user_statistics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own statistics" ON public.user_statistics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own statistics" ON public.user_statistics FOR UPDATE USING (auth.uid() = user_id);

-- Trading Accounts RLS
CREATE POLICY "Users can view own trading accounts" ON public.trading_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trading accounts" ON public.trading_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trading accounts" ON public.trading_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trading accounts" ON public.trading_accounts FOR DELETE USING (auth.uid() = user_id);

-- Journals RLS
CREATE POLICY "Users can view own journals" ON public.journals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journals" ON public.journals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journals" ON public.journals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own journals" ON public.journals FOR DELETE USING (auth.uid() = user_id);

-- Trades RLS
CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

-- Trade Images RLS
CREATE POLICY "Users can view own trade images" ON public.trade_images FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trade images" ON public.trade_images FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own trade images" ON public.trade_images FOR DELETE USING (auth.uid() = user_id);

-- User Settings RLS
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- AUTOMATIC PROFILE CREATION TRIGGER
-- -----------------------------------------------------------------------------

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
    full_name = EXCLUDED.full_name,
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

-- Trigger execution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STORAGE BUCKET FOR AVATARS
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;
