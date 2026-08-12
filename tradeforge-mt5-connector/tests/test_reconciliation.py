"""
Phase 7 Test Suite: History Reconciliation, Deduplication & Data Integrity.
Tests cursor safety, idempotency, failure recovery, chunking, and precision preservation.
"""

import unittest
from unittest.mock import MagicMock
from datetime import datetime, timezone, timedelta
from app.storage.database import ConnectorDatabase
from app.sync.reconciliation_sync import ReconciliationSyncWorker


class TestReconciliation(unittest.TestCase):

    def setUp(self):
        self.mock_db = MagicMock(spec=ConnectorDatabase)
        self.mock_reader = MagicMock()
        self.mock_api = MagicMock()
        self.worker = ReconciliationSyncWorker(
            history_reader=self.mock_reader,
            trade_api=self.mock_api,
            db=self.mock_db
        )

    def test_reconciliation_empty_history(self):
        """Verifies clean handling when MT5 returns 0 closed deals in window."""
        self.mock_reader.fetch_closed_trades.return_value = []

        result = self.worker.reconcile_account_history(
            connector_id="conn_123",
            account_number="10001",
            days=30
        )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["total_fetched"], 0)
        self.assertEqual(result["inserted_count"], 0)
        self.assertEqual(result["duplicate_count"], 0)
        self.mock_api.upload_trade_batch.assert_not_called()

    def test_idempotent_reconciliation_mixed_batch(self):
        """Verifies idempotency and proper counting of inserted vs duplicate trades."""
        mock_deals = [
            {"deal_id": "101", "symbol": "EURUSD", "profit": 15.5},
            {"deal_id": "102", "symbol": "GBPUSD", "profit": -5.0},
            {"deal_id": "103", "symbol": "XAUUSD", "profit": 50.0},
        ]
        self.mock_reader.fetch_closed_trades.return_value = mock_deals

        # Mock API response: 1 inserted, 2 duplicates (already existed)
        self.mock_api.upload_trade_batch.return_value = {
            "batch_id": "batch_999",
            "total_received": 3,
            "inserted_count": 1,
            "duplicate_count": 2,
            "error_count": 0,
            "status": "success"
        }

        result = self.worker.reconcile_account_history(
            connector_id="conn_123",
            account_number="10001",
            days=30
        )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["total_fetched"], 3)
        self.assertEqual(result["inserted_count"], 1)
        self.assertEqual(result["duplicate_count"], 2)
        self.assertEqual(result["error_count"], 0)

        # Verify SQLite cursor update was recorded
        self.mock_db.update_sync_cursor.assert_called_once()
        self.mock_db.record_sync_result.assert_called_once_with(
            batch_id="batch_999",
            account_number="10001",
            inserted_count=1,
            duplicate_count=2,
            error_count=0
        )

    def test_chunking_large_history_payload(self):
        """Verifies payloads exceeding 500 deals are split into 500-item chunks for contract compliance."""
        mock_deals = [{"deal_id": str(i), "symbol": "EURUSD", "profit": 1.0} for i in range(1250)]
        self.mock_reader.fetch_closed_trades.return_value = mock_deals

        self.mock_api.upload_trade_batch.side_effect = [
            {"batch_id": "b1", "inserted_count": 500, "duplicate_count": 0, "error_count": 0, "status": "success"},
            {"batch_id": "b2", "inserted_count": 500, "duplicate_count": 0, "error_count": 0, "status": "success"},
            {"batch_id": "b3", "inserted_count": 250, "duplicate_count": 0, "error_count": 0, "status": "success"},
        ]

        result = self.worker.reconcile_account_history(
            connector_id="conn_123",
            account_number="10001",
            days=30
        )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["total_fetched"], 1250)
        self.assertEqual(result["inserted_count"], 1250)
        self.assertEqual(self.mock_api.upload_trade_batch.call_count, 3)

    def test_cursor_advancement_safeguard_on_failure(self):
        """Verifies local cursor is marked as error/failed if upload raises an exception."""
        self.mock_reader.fetch_closed_trades.return_value = [{"deal_id": "999"}]
        self.mock_api.upload_trade_batch.side_effect = Exception("API Server Outage 503")

        result = self.worker.reconcile_account_history(
            connector_id="conn_123",
            account_number="10001",
            days=30
        )

        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error_count"], 1)
        # Verify db status was set to failed
        args, kwargs = self.mock_db.update_sync_cursor.call_args
        self.assertEqual(kwargs.get("status"), "failed")


if __name__ == "__main__":
    unittest.main()
