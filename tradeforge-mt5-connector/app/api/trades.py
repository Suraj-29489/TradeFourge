"""
Trade Batch Ingestion API Service.
Uploads closed MT5 trades to POST /api/mt5/trades/batch.
Automatically chunks trade batches to max 500 items per request as required by Phase 3 contract.
"""

import logging
from app.config import config
from app.api.client import TradeForgeAPIClient
from app.errors import ConnectorError

logger = logging.getLogger("tradeforge.api.trades")


class TradeBatchService:
    """Handles trade history batch uploading and auto-chunking."""

    def __init__(self, api_client: TradeForgeAPIClient | None = None):
        self.client = api_client or TradeForgeAPIClient()

    def upload_trade_batch(
        self,
        connector_id: str,
        account_number: str,
        trades: list[dict],
        batch_type: str = "closed_trades",
        server: str | None = None
    ) -> dict:
        """
        Uploads normalized trade payload dicts to TradeForge API in chunks of <= 500 items.
        Returns aggregated summary: total_received, inserted_count, duplicate_count, error_count.
        """
        if not trades:
            return {
                "batch_id": None,
                "total_received": 0,
                "inserted_count": 0,
                "duplicate_count": 0,
                "error_count": 0,
                "status": "success"
            }

        total_received = len(trades)
        inserted_count = 0
        duplicate_count = 0
        error_count = 0
        last_batch_id = None

        CHUNK_SIZE = min(config.batch_size, 500)  # Enforce max 500 limit

        for i in range(0, total_received, CHUNK_SIZE):
            chunk = trades[i:i + CHUNK_SIZE]
            
            payload = {
                "connector_id": connector_id,
                "account_number": str(account_number),
                "batch_type": batch_type,
                "trades": chunk
            }
            if server:
                payload["server"] = server

            logger.info(
                "[TRADE_SYNC] Uploading trade batch chunk (%d to %d of %d deals)...",
                i + 1, i + len(chunk), total_received
            )

            try:
                res_data = self.client.request(
                    method="POST",
                    endpoint="/api/mt5/trades/batch",
                    json_data=payload,
                    requires_auth=True
                )
                
                last_batch_id = res_data.get("batch_id")
                inserted_count += res_data.get("inserted_count", 0)
                duplicate_count += res_data.get("duplicate_count", 0)
                error_count += res_data.get("error_count", 0)

            except ConnectorError as err:
                logger.error("[TRADE_SYNC] Failed to upload trade batch chunk: %s", err.message)
                raise

        logger.info(
            "[TRADE_SYNC] Batch upload finished — Total: %d, Inserted: %d, Duplicates: %d, Errors: %d",
            total_received, inserted_count, duplicate_count, error_count
        )

        return {
            "batch_id": last_batch_id,
            "total_received": total_received,
            "inserted_count": inserted_count,
            "duplicate_count": duplicate_count,
            "error_count": error_count,
            "status": "success" if error_count == 0 else "partial"
        }
