"""
Connector Pairing Service.
Handles initial pairing flow against POST /api/mt5/pair.
Safely stores returned API key in OS Credential Manager and connector_id in SQLite.
"""

import logging
from app.api.client import TradeForgeAPIClient
from app.security.credentials import CredentialManager
from app.storage.database import ConnectorDatabase
from app.errors import ConnectorError

logger = logging.getLogger("tradeforge.api.pairing")


class PairingService:
    """Orchestrates desktop connector pairing with TradeForge user account."""

    def __init__(self, api_client: TradeForgeAPIClient | None = None, db: ConnectorDatabase | None = None):
        self.client = api_client or TradeForgeAPIClient()
        self.db = db or ConnectorDatabase()

    def pair_connector(
        self,
        user_email: str,
        pairing_code: str | None = None,
        connector_name: str = "Desktop MT5 Terminal"
    ) -> tuple[bool, str]:
        """
        Executes pairing request. Returns (success, message_or_connector_id).
        """
        logger.info("[PAIRING] Initiating pairing for %s (%s)...", user_email, connector_name)
        
        payload = {
            "user_email": user_email.strip(),
            "connector_name": connector_name.strip()
        }
        if pairing_code:
            payload["pairing_code"] = pairing_code.strip()

        try:
            res_data = self.client.request(
                method="POST",
                endpoint="/api/mt5/pair",
                json_data=payload,
                requires_auth=False
            )

            connector_id = res_data.get("connector_id")
            api_key = res_data.get("api_key")

            if not connector_id or not api_key:
                return False, "Invalid response from pairing endpoint (missing connector_id or api_key)."

            # 1. Store API key in OS Credential Manager
            if not CredentialManager.store_api_key(api_key):
                return False, "Failed to store API key in OS Credential Manager."

            # 2. Store connector config in local SQLite DB
            self.db.save_config(connector_id=connector_id, api_url=self.client.base_url)

            logger.info("[PAIRING] Successfully paired connector ID %s!", connector_id)
            return True, connector_id

        except ConnectorError as err:
            logger.error("[PAIRING] Pairing failed: %s", err.message)
            return False, err.message
        except Exception as err:
            logger.error("[PAIRING] Unexpected error during pairing: %s", err)
            return False, str(err)
