"""
Live State API Service wrapper for TradeForge MT5 Connector.
Transmits 1-5 second live position and account metrics snapshot to TradeForge backend.
"""

import logging
from app.api.client import TradeForgeAPIClient

logger = logging.getLogger("tradeforge.api.live")


class LiveStateService:
    """Service wrapper for POST /api/mt5/live endpoint."""

    def __init__(self, api_client: TradeForgeAPIClient | None = None):
        self.client = api_client or TradeForgeAPIClient()

    def upload_live_state(
        self,
        connector_id: str,
        account_number: str,
        observed_at: str,
        balance: float,
        equity: float,
        floating_pnl: float,
        margin: float,
        free_margin: float,
        margin_level: float | None,
        positions: list[dict]
    ) -> dict:
        """Transmits live floating P/L, equity, and open positions snapshot to TradeForge API."""
        payload = {
            "connector_id": connector_id,
            "account_number": str(account_number),
            "observed_at": observed_at,
            "balance": float(balance),
            "equity": float(equity),
            "floating_pnl": float(floating_pnl),
            "margin": float(margin),
            "free_margin": float(free_margin),
            "margin_level": float(margin_level) if margin_level is not None else None,
            "positions": positions
        }

        response = self.client.request(
            method="POST",
            endpoint="/api/mt5/live",
            json_data=payload,
            requires_auth=True,
            max_retries=1  # Fast return for live sync
        )

        logger.debug(
            "[LIVE] Transmitted live snapshot for account %s (%d open positions, floating P/L: %.2f)",
            account_number,
            len(positions),
            floating_pnl
        )

        return response
