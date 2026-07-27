-- =============================================================================
-- TradeFourge — Migration: Add magic_number to public.trades
-- Version: v3.2.6.x
-- Generated: 2026-07-28
--
-- SAFE TO RUN MULTIPLE TIMES.
-- Adds magic_number column to public.trades table without modifying or
-- deleting any existing trade data.
-- =============================================================================

ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS magic_number BIGINT DEFAULT NULL;

-- Optional index for filtering trades by MetaTrader EA Magic Number
CREATE INDEX IF NOT EXISTS idx_trades_magic_number 
  ON public.trades(user_id, magic_number) 
  WHERE magic_number IS NOT NULL;
