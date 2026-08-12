"""
SQLite Schema Definitions and Versioning for Local Operational State.
"""

CURRENT_SCHEMA_VERSION = 1

INIT_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS connector_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    connector_id TEXT,
    api_url TEXT NOT NULL,
    paired_at TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_state (
    account_number TEXT PRIMARY KEY,
    last_history_sync TEXT,
    last_successful_sync TEXT,
    last_sync_status TEXT DEFAULT 'pending',
    total_synced_deals INTEGER DEFAULT 0,
    last_reconciliation_at TEXT,
    reconciliation_status TEXT DEFAULT 'idle',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS known_accounts (
    account_number TEXT PRIMARY KEY,
    server TEXT NOT NULL,
    broker TEXT NOT NULL,
    currency TEXT DEFAULT 'USD',
    last_seen TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_results (
    batch_id TEXT PRIMARY KEY,
    account_number TEXT NOT NULL,
    inserted_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    synced_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""
