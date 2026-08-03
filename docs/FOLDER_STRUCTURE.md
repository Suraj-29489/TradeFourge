# TradeFourge Repository Folder Structure

This document outlines every major folder and module in the TradeFourge codebase.

---

## 1. Directory Sitemap Overview

```
TradeFourge/
├── app/                      # Next.js 15 App Router pages & API routes
│   ├── (app)/                # Authenticated application route group
│   │   ├── accounts/         # Multi-account management page
│   │   ├── dashboard/        # Executive trading performance dashboard
│   │   ├── import-history/   # Searchable CSV import audit history page
│   │   ├── journal/          # Interactive trade journal & trade table
│   │   ├── performance/      # Performance analytics overview
│   │   ├── reports/          # Detailed trade audit reports & PDF export
│   │   ├── settings/         # Profile & account settings page
│   │   ├── statistics/       # Statistical metrics & distributions
│   │   ├── trades/           # Comprehensive trade table view
│   │   └── upload/           # CSV Import Engine 2.0 multi-step workflow
│   ├── auth/                 # Authentication callback routes
│   ├── login/                # Auth login page
│   ├── signup/               # Auth signup page
│   ├── globals.css           # Institutional design system CSS tokens & styles
│   └── layout.tsx            # Global layout wrapper
├── components/               # React UI component library
│   ├── accounts/             # Account creation & edit modals
│   ├── export/               # Export toolbar components
│   ├── trades/               # Trade table & manual trade entry modal
│   ├── ui/                   # Reusable UI primitives (Button, Card, Badge, Modal, etc.)
│   └── upload/               # CsvUploader multi-step import component
├── context/                  # Global React Context providers
│   ├── AccountsContext.tsx   # Account state provider
│   └── UserProfileContext.ts # User profile & account state provider
├── hooks/                    # Reusable custom React hooks
│   └── useAccounts.ts        # Hook for accessing trading accounts state
├── lib/                      # Core business logic, calculation engines & services
│   ├── analytics/            # Pure Mathematical Analytics Engine 1.0
│   │   ├── distribution/     # Chart distribution data generators
│   │   ├── equity/           # Equity & drawdown curve calculations
│   │   ├── performance/      # Core PnL, profit factor, win rate modules
│   │   ├── risk/             # Risk metrics, Sharpe ratio, R-multiple binnings
│   │   ├── symbol/           # Per-symbol trade & volume analytics
│   │   ├── time/             # Session, hourly, weekday & returns analytics
│   │   ├── index.ts          # Unified analytics entry point
│   │   └── types.ts          # Analytics TypeScript interfaces
│   ├── config/               # Application configuration constants
│   ├── engine/               # CSV Engine 2.0 validation & normalization engine
│   │   ├── validation/       # Modular validation modules (file, column, broker, data, fingerprint)
│   │   ├── batch-processor.ts# Streaming non-blocking batch processor
│   │   ├── normalizer.ts     # Data normalizer (symbol, date, USC currency)
│   │   └── validator.ts      # CSV parser validation wrapper
│   ├── events/               # Event bus event emitter
│   ├── export/               # Report exporter modules (CSV & PDF)
│   └── supabase/             # Database services & Supabase client APIs
├── types/                    # TypeScript interfaces & database schemas
│   ├── database.ts           # PostgreSQL table schemas (CloudTrade, CsvImport, TradingAccount)
│   └── trade.ts              # Legacy trade interface definitions
└── docs/                     # Institutional technical documentation
```

---

## 2. Explanation of Major Directories

### `app/`
Contains Next.js 15 App Router pages. Routes enclosed in `(app)` share the authenticated main navigation layout.

### `components/ui/`
Contains TradeFourge v3.9 reusable design system primitives:
- `Button.tsx`: Unified button hierarchy.
- `Card.tsx`: Graphite card container primitive.
- `Badge.tsx`: Pill badge component.
- `Modal.tsx`: Raycast/Linear style dialog component.
- `EmptyState.tsx`: Vercel/Notion style empty state layout.
- `LoadingSkeleton.tsx`: Dark shimmer loading placeholders.

### `lib/analytics/`
Houses the pure mathematical analytics calculation engine. No React code or database calls exist in this folder.

### `lib/engine/` & `lib/engine/validation/`
Houses CSV Import Engine 2.0:
- `file-validator.ts`: File existence, size, readability check.
- `column-validator.ts`: Flexible header alias matching.
- `broker-detector.ts`: Identifies MT4, MT5, Exness, FTMO, IC Markets, cTrader.
- `data-validator.ts`: Row date, volume, and PnL validation.
- `fingerprint.ts`: Deterministic trade fingerprint generator and in-file duplicate analyzer.
- `batch-processor.ts`: Streaming batch processor for 50,000+ trade CSV files.

### `lib/export/`
Contains client-side report exporters for CSV and PDF audit documents.
