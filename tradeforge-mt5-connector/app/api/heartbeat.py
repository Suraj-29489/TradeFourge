"""
Heartbeat Service.
Sends periodic liveness pings to POST /api/mt5/heartbeat.
"""

import logging
from app.config import config
from app.api.client import TradeForgeAPIClient
from app.errors import ConnectorError

logger = logging.getLogger("tradeforge.api.heartbeat")


class HeartbeatService:
    """Handles connector liveness heartbeat pings."""

    def __init__(self, api_client: TradeForgeAPIClient | None = None):
        self.client = api_client or TradeForgeAPIClient()

    def send_heartbeat(
        self,
        connector_id: str,
        connected_accounts: list[str] | None = None
    ) -> int:
        """
        Sends heartbeat ping to backend. Returns next_heartbeat_seconds (default 60).
        """
        payload = {
            "connector_id": connector_id,
            "version": config.connector_version,
            "connected_accounts": connected_accounts or []
        }

        try:
            res_data = self.client.request(
                method="POST",
                endpoint="/api/mt5/heartbeat",
                json_data=payload,
                requires_auth=True
            )
            next_sec = res_data.get("next_heartbeat_seconds", config.heartbeat_interval_sec)
            logger.debug("[HEARTBEAT] Ping success. Active accounts: %d", len(connected_accounts or []))
            return next_sec
        except ConnectorError as err:
            logger.warning("[HEARTBEAT] Ping failed: %s", err.message)
            return config.heartbeat_interval_sec
