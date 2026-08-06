-- Migration: Create trade_journals table with Row Level Security (RLS) policies and indexes
-- Target: PostgreSQL / Supabase
-- Version: 5.5.0

CREATE TABLE IF NOT EXISTS public.trade_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'General Market Journal' NOT NULL,
    mood TEXT DEFAULT 'Calm' NOT NULL,
    confidence INT DEFAULT 80 NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    tags TEXT[] DEFAULT '{}'::text[] NOT NULL,
    session TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.trade_journals ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DROP POLICY IF EXISTS "Users can view own trade journals" ON public.trade_journals;
CREATE POLICY "Users can view own trade journals" ON public.trade_journals FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own trade journals" ON public.trade_journals;
CREATE POLICY "Users can insert own trade journals" ON public.trade_journals FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own trade journals" ON public.trade_journals;
CREATE POLICY "Users can update own trade journals" ON public.trade_journals FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own trade journals" ON public.trade_journals;
CREATE POLICY "Users can delete own trade journals" ON public.trade_journals FOR DELETE USING (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_trade_journals_user_id ON public.trade_journals(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_journals_trade_id ON public.trade_journals(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_journals_created_at ON public.trade_journals(created_at DESC);
