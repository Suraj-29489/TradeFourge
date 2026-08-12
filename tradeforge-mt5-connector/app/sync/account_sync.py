"""
Account Synchronization Worker.
Reads MT5 account info and pushes updates to TradeForge API.
"""

import logging
from app.mt5.account_reader import AccountReader
from app.api.accounts import AccountSyncService
from app.storage.database import ConnectorDatabase

logger = logging.getLogger("tradeforge.sync.account")


class AccountSyncWorker:
    """Coordinates reading and syncing account metadata."""

    def __init__(
        self,
        account_reader: AccountReader,
        account_api: AccountSyncService,
        db: ConnectorDatabase
    ):
        self.reader = account_reader
        self.api = account_api
        self.db = db

    def sync(self, connector_id: str) -> dict | None:
        """Reads MT5 account info, syncs to API, and updates local database."""
        acc_payload = self.reader.read_account()
        if not acc_payload:
            logger.warning("[ACCOUNT_SYNC] Skipped sync — No active MT5 account.")
            return None

        account_num = acc_payload["account_number"]
        server = acc_payload["server"]
        broker = acc_payload["broker"]
        currency = acc_payload["currency"]

        # Sync to TradeForge API
        res = self.api.sync_accounts(connector_id=connector_id, accounts=[acc_payload])

        # Record in local SQLite DB
        self.db.record_known_account(
            account_number=account_num,
            server=server,
            broker=broker,
            currency=currency
        )

        return res
