"""
Reconciliation Sync Worker.
Periodically re-scans historical windows to capture delayed deal records and repair missing trades.
Leverages the idempotent database unique constraint to prevent duplication.
"""

import logging
from app.sync.reconciliation_sync import ReconciliationSyncWorker

logger = logging.getLogger("tradeforge.sync.reconciliation")


class ReconciliationWorker:
    """Executes periodic historical reconciliation."""

    def __init__(self, history_worker=None, reconciliation_sync_worker: ReconciliationSyncWorker | None = None):
        self.history_worker = history_worker
        if reconciliation_sync_worker:
            self.sync_worker = reconciliation_sync_worker
        elif history_worker:
            self.sync_worker = ReconciliationSyncWorker(
                history_worker.reader, history_worker.api, history_worker.db
            )
        else:
            self.sync_worker = None

    def reconcile_account(self, connector_id: str, account_number: str, server: str | None = None, days: int = 30) -> dict:
        """Runs a history reconciliation scan for specified days."""
        if not self.sync_worker:
            raise ValueError("ReconciliationWorker not properly initialized with reader and API.")
        return self.sync_worker.reconcile_account_history(
            connector_id=connector_id,
            account_number=account_number,
            days=days,
            server=server
        )

