"""
Account Metadata Sync Service.
Synchronizes MT5 account balance, equity, margin, leverage, and server metadata with POST /api/mt5/accounts/sync.
"""

import logging
from app.api.client import TradeForgeAPIClient
from app.errors import ConnectorError

logger = logging.getLogger("tradeforge.api.accounts")


class AccountSyncService:
    """Synchronizes discovered MT5 account metadata with TradeForge."""

    def __init__(self, api_client: TradeForgeAPIClient | None = None):
        self.client = api_client or TradeForgeAPIClient()

    def sync_accounts(self, connector_id: str, accounts: list[dict]) -> dict:
        """
        Sends account metadata payload to backend.
        Returns response dict containing synced_total, created_count, updated_count.
        """
        if not accounts:
            logger.debug("[ACCOUNT_SYNC] No accounts to synchronize.")
            return {"synced_total": 0, "created_count": 0, "updated_count": 0}

        payload = {
            "connector_id": connector_id,
            "accounts": accounts
        }

        try:
            res_data = self.client.request(
                method="POST",
                endpoint="/api/mt5/accounts/sync",
                json_data=payload,
                requires_auth=True
            )
            created = res_data.get("created_count", 0)
            updated = res_data.get("updated_count", 0)
            logger.info(
                "[ACCOUNT_SYNC] Account sync complete — Created: %d, Updated: %d",
                created, updated
            )
            return res_data
        except ConnectorError as err:
            logger.error("[ACCOUNT_SYNC] Account metadata sync failed: %s", err.message)
            raise
