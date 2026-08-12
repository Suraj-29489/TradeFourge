"""
Tests for History Synchronization Worker and Batch Chunking.
"""

import unittest
import tempfile
from pathlib import Path
from unittest.mock import MagicMock
from tests.mock_mt5 import MockMT5Client
from app.storage.database import ConnectorDatabase
from app.sync.history_sync import HistorySyncWorker
from app.mt5.history_reader import HistoryReader
from app.api.trades import TradeBatchService


class TestHistorySync(unittest.TestCase):

    def setUp(self):
        self.tmp_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db_path = Path(self.tmp_file.name)
        self.db = ConnectorDatabase(db_path=self.db_path)
        self.mock_mt5 = MockMT5Client()

    def tearDown(self):
        try:
            self.db_path.unlink(missing_ok=True)
        except Exception:
            pass

    def test_history_sync_initial_and_incremental(self):
        reader = HistoryReader(self.mock_mt5)
        
        mock_trade_api = MagicMock(spec=TradeBatchService)
        mock_trade_api.upload_trade_batch.return_value = {
            "batch_id": "batch_test_123",
            "total_received": 2,
            "inserted_count": 2,
            "duplicate_count": 0,
            "error_count": 0,
            "status": "success"
        }

        worker = HistorySyncWorker(
            history_reader=reader,
            trade_api=mock_trade_api,
            db=self.db
        )

        # 1. Initial Sync
        res1 = worker.sync_account_history("conn_123", "267588210", force_full_history=True)
        self.assertTrue(mock_trade_api.upload_trade_batch.called)
        self.assertEqual(res1["inserted_count"], 2)

        # Check cursor saved in DB
        sync_state = self.db.get_sync_state("267588210")
        self.assertIsNotNone(sync_state)
        self.assertIsNotNone(sync_state.last_history_sync)
        self.assertEqual(sync_state.total_synced_deals, 2)

        # 2. Incremental Sync (cursor present)
        mock_trade_api.upload_trade_batch.reset_mock()
        mock_trade_api.upload_trade_batch.return_value = {
            "batch_id": "batch_test_124",
            "total_received": 2,
            "inserted_count": 0,
            "duplicate_count": 2,
            "error_count": 0,
            "status": "success"
        }

        res2 = worker.sync_account_history("conn_123", "267588210")
        self.assertEqual(res2["duplicate_count"], 2)
        self.assertEqual(sync_state.total_synced_deals, 2)


if __name__ == "__main__":
    unittest.main()
