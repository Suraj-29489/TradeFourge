"""
SQLite Storage Repository Manager.
Manages connector_state.db for operational state, cursors, and sync history logs.
DOES NOT replace Supabase (does not store full trade database).
"""

import sqlite3
import logging
from pathlib import Path
from datetime import datetime, timezone
from app.config import config
from app.storage.schema import CURRENT_SCHEMA_VERSION, INIT_SCHEMA_SQL
from app.storage.models import ConnectorConfig, SyncState, KnownAccount, SyncResult
from app.errors import DatabaseSyncError

logger = logging.getLogger("tradeforge.storage")


def get_utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class ConnectorDatabase:
    """Encapsulates all local SQLite operational state storage operations."""

    def __init__(self, db_path: Path | str | None = None):
        self.db_path = Path(db_path) if db_path else config.sqlite_db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        try:
            conn = sqlite3.connect(self.db_path, timeout=10.0)
            conn.row_factory = sqlite3.Row
            return conn
        except sqlite3.Error as err:
            raise DatabaseSyncError(f"Failed to connect to SQLite at {self.db_path}: {err}")

    def _init_db(self):
        """Initializes tables and verifies schema version."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.executescript(INIT_SCHEMA_SQL)
            
            cursor.execute("SELECT version FROM schema_version LIMIT 1")
            row = cursor.fetchone()
            if not row:
                cursor.execute("INSERT INTO schema_version (version) VALUES (?)", (CURRENT_SCHEMA_VERSION,))
                conn.commit()

    # ─── CONNECTOR CONFIG ───────────────────────────────────────────────────────

    def get_config(self) -> ConnectorConfig | None:
        with self._get_connection() as conn:
            row = conn.execute("SELECT connector_id, api_url, paired_at FROM connector_config WHERE id = 1").fetchone()
            if row:
                return ConnectorConfig(
                    connector_id=row["connector_id"],
                    api_url=row["api_url"],
                    paired_at=row["paired_at"]
                )
            return None

    def save_config(self, connector_id: str, api_url: str):
        now_iso = get_utc_now_iso()
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO connector_config (id, connector_id, api_url, paired_at, updated_at)
                VALUES (1, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    connector_id = excluded.connector_id,
                    api_url = excluded.api_url,
                    paired_at = excluded.paired_at,
                    updated_at = excluded.updated_at
                """,
                (connector_id, api_url, now_iso, now_iso)
            )
            conn.commit()

    # ─── SYNC STATE & CURSORS ─────────────────────────────────────────────────

    def get_sync_state(self, account_number: str) -> SyncState | None:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT account_number, last_history_sync, last_successful_sync, last_sync_status, total_synced_deals FROM sync_state WHERE account_number = ?",
                (str(account_number),)
            ).fetchone()
            if row:
                return SyncState(
                    account_number=row["account_number"],
                    last_history_sync=row["last_history_sync"],
                    last_successful_sync=row["last_successful_sync"],
                    last_sync_status=row["last_sync_status"],
                    total_synced_deals=row["total_synced_deals"]
                )
            return None

    def update_sync_cursor(
        self,
        account_number: str,
        last_history_sync: str,
        last_successful_sync: str | None = None,
        status: str = "success",
        add_synced_count: int = 0
    ):
        now_iso = get_utc_now_iso()
        with self._get_connection() as conn:
            existing = self.get_sync_state(account_number)
            current_total = (existing.total_synced_deals if existing else 0) + add_synced_count
            successful_ts = last_successful_sync or (existing.last_successful_sync if existing else None)

            conn.execute(
                """
                INSERT INTO sync_state (account_number, last_history_sync, last_successful_sync, last_sync_status, total_synced_deals, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(account_number) DO UPDATE SET
                    last_history_sync = excluded.last_history_sync,
                    last_successful_sync = COALESCE(excluded.last_successful_sync, sync_state.last_successful_sync),
                    last_sync_status = excluded.last_sync_status,
                    total_synced_deals = excluded.total_synced_deals,
                    updated_at = excluded.updated_at
                """,
                (str(account_number), last_history_sync, successful_ts, status, current_total, now_iso)
            )
            conn.commit()

    # ─── KNOWN ACCOUNTS ────────────────────────────────────────────────────────

    def record_known_account(self, account_number: str, server: str, broker: str, currency: str):
        now_iso = get_utc_now_iso()
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO known_accounts (account_number, server, broker, currency, last_seen)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(account_number) DO UPDATE SET
                    server = excluded.server,
                    broker = excluded.broker,
                    currency = excluded.currency,
                    last_seen = excluded.last_seen
                """,
                (str(account_number), server, broker, currency, now_iso)
            )
            conn.commit()

    # ─── AUDIT SYNC RESULTS ───────────────────────────────────────────────────

    def record_sync_result(
        self,
        batch_id: str,
        account_number: str,
        inserted_count: int,
        duplicate_count: int,
        error_count: int
    ):
        now_iso = get_utc_now_iso()
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO sync_results (batch_id, account_number, inserted_count, duplicate_count, error_count, synced_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(batch_id) DO NOTHING
                """,
                (batch_id, str(account_number), inserted_count, duplicate_count, error_count, now_iso)
            )
            conn.commit()
