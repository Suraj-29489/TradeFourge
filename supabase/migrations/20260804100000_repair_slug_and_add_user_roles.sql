-- =============================================================================
-- TradeFourge v5.1.1 — Migration: Repair trading_accounts.slug & Add profiles.role
-- Migration File: 20260804100000_repair_slug_and_add_user_roles.sql
-- =============================================================================

-- 1. TRADING ACCOUNTS SCHEMA REPAIR
-- Add slug column to public.trading_accounts if missing
ALTER TABLE public.trading_accounts 
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill existing accounts with normalized slug generated from account_name
UPDATE public.trading_accounts
SET slug = LOWER(REGEXP_REPLACE(account_name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

-- Ensure index exists for slug lookups
CREATE INDEX IF NOT EXISTS idx_trading_accounts_slug 
ON public.trading_accounts(slug);

-- 2. USER PROFILES ROLE SYSTEM
-- Add role column to public.profiles if missing
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Ensure role constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('owner', 'admin', 'support', 'user'));
    END IF;
END $$;

-- Default NULL roles to 'user'
UPDATE public.profiles
SET role = 'user'
WHERE role IS NULL;

-- Create index for fast role checks
CREATE INDEX IF NOT EXISTS idx_profiles_role 
ON public.profiles(role);
