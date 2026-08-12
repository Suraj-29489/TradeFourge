"""
Historical Reconciliation Sync Worker.
Handles controlled gap detection and repair by comparing MT5 closed deals with TradeForge stored trades.
Idempotent, memory-safe, chunked execution with detailed audit logging.
"""

import logging
from datetime import datetime, timedelta, timezone
from app.config import config
from app.mt5.history_reader import HistoryReader
from app.api.trades import TradeBatchService
from app.storage.database import ConnectorDatabase

logger = logging.getLogger("tradeforge.sync.reconciliation")


class ReconciliationSyncWorker:
    """Manages historical trade reconciliation, gap repair, and audit state."""

    def __init__(
        self,
        history_reader: HistoryReader,
        trade_api: TradeBatchService,
        db: ConnectorDatabase
    ):
        self.reader = history_reader
        self.api = trade_api
        self.db = db

    def reconcile_account_history(
        self,
        connector_id: str,
        account_number: str,
        days: int = 30,
        server: str | None = None
    ) -> dict:
        """
        Executes a controlled reconciliation run for the given account over N days.
        Safely chunks large payloads into 500-deal batches.
        """
        account_num_str = str(account_number)
        now_utc = datetime.now(timezone.utc)
        from_dt = now_utc - timedelta(days=days)

        logger.info(
            "[RECONCILE] Account %s: Starting reconciliation run for past %d days (%s to %s)...",
            account_num_str, days, from_dt.strftime("%Y-%m-%d"), now_utc.strftime("%Y-%m-%d")
        )

        # 1. Fetch & Normalize Deals from MT5
        trades_payload = self.reader.fetch_closed_trades(from_date=from_dt, to_date=now_utc)
        total_fetched = len(trades_payload)

        if not trades_payload:
            logger.info("[RECONCILE] Account %s: No closed deals found in MT5 reconciliation window.", account_num_str)
            now_iso = now_utc.isoformat().replace("+00:00", "Z")
            return {
                "account_number": account_num_str,
                "status": "success",
                "total_fetched": 0,
                "inserted_count": 0,
                "duplicate_count": 0,
                "error_count": 0,
                "message": "Reconciliation complete: 0 deals found."
            }

        # 2. Chunk Into Max 500-Deal Batches for API Contract Compliance
        BATCH_SIZE = 500
        total_inserted = 0
        total_duplicates = 0
        total_errors = 0
        batch_results = []

        for i in range(0, total_fetched, BATCH_SIZE):
            chunk = trades_payload[i : i + BATCH_SIZE]
            batch_num = (i // BATCH_SIZE) + 1
            total_batches = (total_fetched + BATCH_SIZE - 1) // BATCH_SIZE

            logger.info(
                "[RECONCILE] Account %s: Uploading batch %d/%d (%d deals)...",
                account_num_str, batch_num, total_batches, len(chunk)
            )

            try:
                sync_res = self.api.upload_trade_batch(
                    connector_id=connector_id,
                    account_number=account_num_str,
                    trades=chunk,
                    batch_type="full_history" if days > 30 else "closed_trades",
                    server=server
                )

                ins = sync_res.get("inserted_count", 0)
                dups = sync_res.get("duplicate_count", 0)
                errs = sync_res.get("error_count", 0)

                total_inserted += ins
                total_duplicates += dups
                total_errors += errs
                batch_results.append(sync_res)

                if sync_res.get("batch_id"):
                    self.db.record_sync_result(
                        batch_id=sync_res["batch_id"],
                        account_number=account_num_str,
                        inserted_count=ins,
                        duplicate_count=dups,
                        error_count=errs
                    )

            except Exception as exc:
                logger.error("[RECONCILE] Account %s: Batch %d upload failed: %s", account_num_str, batch_num, exc)
                total_errors += len(chunk)

        now_iso = now_utc.isoformat().replace("+00:00", "Z")
        final_status = "success" if total_errors == 0 else "partial" if total_inserted > 0 else "failed"

        # Update cursor and local SQLite reconciliation metadata
        self.db.update_sync_cursor(
            account_number=account_num_str,
            last_history_sync=now_iso,
            last_successful_sync=now_iso,
            status=final_status,
            add_synced_count=total_inserted
        )

        logger.info(
            "[RECONCILE] Account %s COMPLETE. Deals: %d | Repaired/Inserted: %d | Duplicates: %d | Errors: %d | Status: %s",
            account_num_str, total_fetched, total_inserted, total_duplicates, total_errors, final_status
        )

        return {
            "account_number": account_num_str,
            "status": final_status,
            "total_fetched": total_fetched,
            "inserted_count": total_inserted,
            "duplicate_count": total_duplicates,
            "error_count": total_errors,
            "batches_processed": len(batch_results),
            "message": f"Reconciliation complete: {total_inserted} trades repaired/inserted, {total_duplicates} duplicates skipped."
        }
