# TradeFourge API & Service Module Specification

This document details the public service modules and utility interfaces in TradeFourge.

---

## 1. Trade Management Services (`lib/supabase/trades.ts`)

### `fetchTrades`
```ts
export async function fetchTrades(
  userId: string,
  filters?: Partial<CloudTradeFilters>,
  page?: number,
  pageSize?: number,
  sortBy?: keyof CloudTrade,
  sortAsc?: boolean
): Promise<ServiceResult<PaginatedResult<CloudTradeWithRelations>>>
```
Fetches paginated trades for a user with optional filters (symbol, outcome, side, date range, account ID, search query).

### `bulkInsertTrades`
```ts
export async function bulkInsertTrades(
  userId: string,
  trades: NewCloudTrade[]
): Promise<{ inserted: number; skippedDuplicates: number; errors: string[] }>
```
Executes deduplication against database records and batch items, inserting unique trades in sub-chunks of 100 items.

### `deleteTrade`
```ts
export async function deleteTrade(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>>
```
Deletes a single trade with explicit SQL verification query confirming removal.

### `deleteAllTrades`
```ts
export async function deleteAllTrades(
  userId: string
): Promise<ServiceResult<number>>
```
Purges all trades for a user with database row count verification.

---

## 2. CSV Import Services (`lib/supabase/csv-imports.ts`)

### `fetchImportHistory`
```ts
export async function fetchImportHistory(
  userId: string
): Promise<ServiceResult<CsvImport[]>>
```
Fetches import statement audit records joined with `trading_accounts`.

### `deleteImportRecord`
```ts
export async function deleteImportRecord(
  id: string,
  userId: string,
  deleteTrades?: boolean
): Promise<DeleteImportResult>
```
Deletes a CSV import record with optional cascading trade deletion and verification.

---

## 3. High-Performance Batch Processor (`lib/engine/batch-processor.ts`)

### `processInBatches`
```ts
export async function processInBatches<T, R>(
  items: T[],
  workerFn: (batch: T[], batchIndex: number) => Promise<R[]>,
  options?: BatchOptions
): Promise<BatchResult<R>>
```
Asynchronous streaming processor yielding main thread control (`setTimeout(..., 5)`) between chunks, providing progress callbacks and cancellation checks for 50,000+ trade datasets.

---

## 4. Report Exporter Services (`lib/export/import-report-exporter.ts`)

### `exportImportReportCsv`
```ts
export function exportImportReportCsv(data: FinalImportReportData): void
```
Generates a downloadable CSV audit report containing configuration metadata, summary metrics, and row failure logs.

### `exportImportReportPdf`
```ts
export function exportImportReportPdf(data: FinalImportReportData): void
```
Generates a downloadable PDF audit document styled with executive summary tables and error logs.
