"""
History Synchronization Worker.
Handles initial full sync, incremental history sync with 5-minute overlap window.
STRICT RULE: Only advances local sync cursor AFTER API ingestion succeeds.
"""

import logging
from datetime import datetime, timedelta, timezone
from app.config import config
from app.mt5.history_reader import HistoryReader
from app.api.trades import TradeBatchService
from app.storage.database import ConnectorDatabase

logger = logging.getLogger("tradeforge.sync.history")


class HistorySyncWorker:
    """Manages closed trade history extraction, batching, and upload."""

    def __init__(
        self,
        history_reader: HistoryReader,
        trade_api: TradeBatchService,
        db: ConnectorDatabase
    ):
        self.reader = history_reader
        self.api = trade_api
        self.db = db

    def sync_account_history(
        self,
        connector_id: str,
        account_number: str,
        server: str | None = None,
        force_full_history: bool = False
    ) -> dict:
        """
        Executes history synchronization for the specified account.
        Uses incremental sync cursor if available, falling back to initial history range.
        """
        account_num_str = str(account_number)
        sync_state = self.db.get_sync_state(account_num_str)
        now_utc = datetime.now(timezone.utc)

        # 1. Determine History Time Window
        if not sync_state or not sync_state.last_successful_sync or force_full_history:
            # Initial Full Sync: Default last N days (e.g. 365 days)
            from_dt = now_utc - timedelta(days=config.initial_history_days)
            batch_type = "full_history"
            logger.info(
                "[HISTORY_SYNC] Account %s: Performing INITIAL sync from %s (%d days)...",
                account_num_str, from_dt.strftime("%Y-%m-%d"), config.initial_history_days
            )
        else:
            # Incremental Sync: From last_successful_sync minus overlap window (e.g. 5 mins)
            try:
                last_succ_dt = datetime.fromisoformat(sync_state.last_successful_sync.replace("Z", "+00:00"))
            except Exception:
                last_succ_dt = now_utc - timedelta(days=config.initial_history_days)

            from_dt = last_succ_dt - timedelta(minutes=config.incremental_overlap_minutes)
            batch_type = "closed_trades"
            logger.info(
                "[HISTORY_SYNC] Account %s: Performing INCREMENTAL sync from %s (with %dm overlap)...",
                account_num_str, from_dt.strftime("%Y-%m-%d %H:%M:%S"), config.incremental_overlap_minutes
            )

        # 2. Fetch & Normalize Deals from MT5
        trades_payload = self.reader.fetch_closed_trades(from_date=from_dt, to_date=now_utc)
        
        if not trades_payload:
            logger.info("[HISTORY_SYNC] Account %s: No new closed deals to synchronize.", account_num_str)
            now_iso = now_utc.isoformat().replace("+00:00", "Z")
            self.db.update_sync_cursor(
                account_number=account_num_str,
                last_history_sync=now_iso,
                last_successful_sync=now_iso,
                status="success",
                add_synced_count=0
            )
            return {"total_received": 0, "inserted_count": 0, "duplicate_count": 0, "error_count": 0}

        # 3. Upload Trade Batch to TradeForge API
        sync_result = self.api.upload_trade_batch(
            connector_id=connector_id,
            account_number=account_num_str,
            trades=trades_payload,
            batch_type=batch_type,
            server=server
        )

        now_iso = now_utc.isoformat().replace("+00:00", "Z")

        # 4. Advance Local Cursor ONLY AFTER SUCCESSFUL UPLOAD
        self.db.update_sync_cursor(
            account_number=account_num_str,
            last_history_sync=now_iso,
            last_successful_sync=now_iso,
            status=sync_result.get("status", "success"),
            add_synced_count=sync_result.get("inserted_count", 0)
        )

        # Record audit entry in local SQLite
        if sync_result.get("batch_id"):
            self.db.record_sync_result(
                batch_id=sync_result["batch_id"],
                account_number=account_num_str,
                inserted_count=sync_result.get("inserted_count", 0),
                duplicate_count=sync_result.get("duplicate_count", 0),
                error_count=sync_result.get("error_count", 0)
            )

        return sync_result
