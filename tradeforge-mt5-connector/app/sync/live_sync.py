"""
Live State Sync Worker for TradeForge MT5 Connector.
Orchestrates reading live account metrics and open MT5 positions every 1-5 seconds.
"""

import logging
from datetime import datetime, timezone
from app.mt5.account_reader import AccountReader
from app.mt5.position_reader import PositionReader
from app.api.live import LiveStateService

logger = logging.getLogger("tradeforge.sync.live")


class LiveSyncWorker:
    """Worker responsible for reading live MT5 state and streaming to backend."""

    def __init__(
        self,
        account_reader: AccountReader,
        position_reader: PositionReader,
        live_api: LiveStateService | None = None
    ):
        self.account_reader = account_reader
        self.position_reader = position_reader
        self.api = live_api or LiveStateService()

    def sync_live_state(self, connector_id: str) -> dict | None:
        """Reads live account + open positions snapshot and uploads to TradeForge API."""
        acc_payload = self.account_reader.read_account()
        if not acc_payload:
            logger.debug("[LIVE_SYNC] Cannot sync live state: No active account logged in MT5.")
            return None

        account_number = acc_payload["account_number"]
        balance = acc_payload.get("balance", 0.0)
        equity = acc_payload.get("equity", balance)
        margin = acc_payload.get("margin", 0.0)
        free_margin = acc_payload.get("free_margin", 0.0)
        margin_level = acc_payload.get("margin_level")

        # Calculate total floating P/L
        floating_pnl = equity - balance

        # Read open positions
        positions = self.position_reader.read_open_positions()

        # Observed timestamp in UTC ISO format
        observed_at = datetime.now(timezone.utc).isoformat()

        try:
            result = self.api.upload_live_state(
                connector_id=connector_id,
                account_number=account_number,
                observed_at=observed_at,
                balance=balance,
                equity=equity,
                floating_pnl=floating_pnl,
                margin=margin,
                free_margin=free_margin,
                margin_level=margin_level,
                positions=positions
            )
            return result
        except Exception as err:
            logger.warning("[LIVE_SYNC] Live state sync notice for account %s: %s", account_number, err)
            return None
