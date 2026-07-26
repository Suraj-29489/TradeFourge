-- TradeFourge SaaS — Migration 20260727000000
-- User Profiles, Preferences, Statistics & Storage RLS Policies

-- 1. EXPAND PROFILES TABLE
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'United States',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS trading_experience TEXT DEFAULT 'Intermediate';

-- 2. CREATE USER PREFERENCES TABLE
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

-- 3. CREATE USER STATISTICS TABLE
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

-- 4. ENABLE RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_statistics ENABLE ROW LEVEL SECURITY;

-- User Preferences RLS Policies
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- User Statistics RLS Policies
CREATE POLICY "Users can view own statistics" ON public.user_statistics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own statistics" ON public.user_statistics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own statistics" ON public.user_statistics
    FOR UPDATE USING (auth.uid() = user_id);

-- 5. UPDATE AUTOMATIC PROFILE CREATION TRIGGER
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. STORAGE BUCKET FOR AVATARS
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS Policies for Avatars
CREATE POLICY "Public read avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users insert own avatar" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar" ON storage.objects
    FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar" ON storage.objects
    FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
