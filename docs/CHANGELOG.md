# TradeFourge Version Changelog

All notable changes and release milestones for TradeFourge are documented in this file.

---

## [v3.9] - Institutional UI System (2026-08-03)
### Added
- **Institutional Design Tokens**: Deep obsidian `#080B11` base, `#0F1420` slate card surfaces, `#161C2B` elevated hover surfaces.
- **Single Accent Palette**: Unified Indigo `#6366F1` / `#4F46E5` accent across buttons, badges, active tabs, and focus rings.
- **Standardized UI Component Primitives**:
  - `Button.tsx`: Unified button primitive (`primary`, `secondary`, `ghost`, `danger`, `outline`).
  - `Card.tsx`: Unified card container primitive (`Card`, `CardHeader`, `CardTitle`).
  - `Badge.tsx`: Linear/Vercel style pill badges (`ImportStatusBadge`, `OutcomeBadge`, `AccountTypeBadge`).
  - `Modal.tsx`: Raycast/Linear style dark dialog modal with backdrop blur.
  - `EmptyState.tsx`: Notion/Vercel style empty state layout with dual action support.
  - `LoadingSkeleton.tsx`: Dark shimmer skeleton loading components.
- **Custom Dark Controls**: Native dark `<select>` and `<option>` styling preventing default browser white popups.

---

## [v3.8] - Analytics Engine 1.0 (2026-08-03)
### Added
- **Pure Mathematical Analytics Engine**: Decoupled analytics modules under `lib/analytics/`.
- **Phase 1 Equity & Balance**: Equity Curve, Balance Curve, Peak Equity, Running Balance, Drawdown Curve.
- **Phase 2 Core Performance**: Net Profit, Gross Profit, Gross Loss, Profit Factor, Expectancy, Average Trade, Average Winner, Average Loser, Largest Winner, Largest Loser.
- **Phase 3 Win/Loss Breakdowns**: Win Rate by Symbol, Win Rate by Day, Win Rate by Week, Win Rate by Month, Long vs Short, Buy vs Sell.
- **Phase 4 Risk & R-Multiple**: Max Drawdown ($ and %), Relative Drawdown, Recovery Factor, Basic Sharpe Ratio, Risk:Reward Ratio, R-Multiple Bins (`< -2R`, `-2R to -1R`, `-1R to 0R`, `0R to 1R`, `1R to 2R`, `> 2R`).
- **Phase 5 Time & Returns**: Holding Time (Avg, Median, Min, Max), Session Performance (Asian, London, New York, Overlap), Best Trading Hour, Best Weekday, Monthly Returns, Daily Returns.
- **Phase 6 Symbol Analytics**: Per-symbol Trade Count, Volume, Profit, Best Symbol, Worst Symbol.
- **Phase 7 Chart Distributions**: Formatted chart props for Equity Curve, Drawdown, Monthly Returns, Daily Heatmap, Win Distribution, and Profit Distribution.

---

## [v3.7.7] - CSV Import Engine 2.0 (Phase 10 Batch Engine) (2026-08-03)
### Added
- **High-Performance Streaming Batch Processor**: Event loop yielding (`setTimeout(..., 5)`) between 500-item chunks.
- **Cancellation Signal Checks**: Responsive UI with live progress tracking (`14,500 / 50,000 trades — 29%`).

---

## [v3.7.6] - CSV Import Engine 2.0 (Phase 9 Audit Log) (2026-08-03)
### Added
- **Searchable Import History**: Multi-field search (`searchTerm` & `statusFilter`) across Account, Broker, Date, Filename, Status.
- **Import Actions**: Summary modal, CSV/PDF download buttons, Re-import router, cascading delete execution.

---

## [v3.7.5] - CSV Import Engine 2.0 (Phase 7 & 8 Exporters) (2026-08-03)
### Added
- **Row Error Audit Inspector**: Highlights line numbers and failure reasons (`Invalid date`, `Missing symbol`, `Invalid lot size`, `Unknown trade type`, `Missing required value`).
- **Post-Import Summary Dashboard**: Displays `Total Rows`, `Imported`, `Skipped`, `Failed`, `Duplicates`, `Warnings`, `Time Taken`, `Broker`, `Account`, `Currency`.
- **Client-side Exporters**: CSV and PDF audit document downloads ([`lib/export/import-report-exporter.ts`](file:///c:/Users/suraj/Desktop/Trading%20Journal/lib/export/import-report-exporter.ts)).

---

## [v3.7.4] - Data Normalization Engine (2026-08-03)
### Added
- **Symbol Canonicalization**: Strips suffixes (`.m`, `.b`, `.ecn`, `.cash`, `_raw`, `.v`, `.std`, `.pro`, `_i`, `#`) and maps synonyms (`GOLD` $\rightarrow$ `XAUUSD`, `DJ30`/`WS30` $\rightarrow$ `US30`, `USTEC`/`NDX100` $\rightarrow$ `NAS100`).
- **Direction & ISO Date Standardization**: Normalizes directions (`BUY` $\rightarrow$ `LONG`, `SELL` $\rightarrow$ `SHORT`) and dates to ISO 8601 UTC strings.
- **Cent Account Normalization**: Converts `USC` monetary metrics ($\div 100$).
