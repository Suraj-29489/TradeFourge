// lib/supabase/journals.ts
// Re-export / Delegate service for managing trade_journals in Supabase.
// Integrates with JournalService in lib/services/JournalService.ts.

import { JournalService, JournalQueryFilters } from '@/lib/services/JournalService';
import type {
  TradeJournal,
  NewTradeJournal,
  UpdateTradeJournal,
  ServiceResult,
} from '@/types/database';

export type TradeJournalFilters = JournalQueryFilters;

export async function fetchTradeJournals(
  userId: string,
  filters: TradeJournalFilters = {}
): Promise<ServiceResult<TradeJournal[]>> {
  return JournalService.getJournals(userId, filters);
}

export async function fetchJournalsByTradeId(
  userId: string,
  tradeId: string
): Promise<ServiceResult<TradeJournal[]>> {
  return JournalService.getJournalsByTradeId(userId, tradeId);
}

export async function createTradeJournal(
  userId: string,
  payload: NewTradeJournal
): Promise<ServiceResult<TradeJournal>> {
  return JournalService.createJournal(userId, payload);
}

export async function updateTradeJournal(
  journalId: string,
  userId: string,
  payload: UpdateTradeJournal
): Promise<ServiceResult<TradeJournal>> {
  return JournalService.updateJournal(journalId, userId, payload);
}

export async function deleteTradeJournal(
  journalId: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  return JournalService.deleteJournal(journalId, userId);
}
