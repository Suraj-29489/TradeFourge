"""
History Deal Reader.
Fetches raw historical deals from MT5 for a specified date range and normalizes them.
Handles chunking and memory optimization for large historical sets.
"""

import logging
from datetime import datetime, timedelta, timezone
from app.mt5.client import BaseMT5Client
from app.mt5.deal_normalizer import normalize_deal

logger = logging.getLogger("tradeforge.mt5.history")


class HistoryReader:
    """Reads closed trade history deals from MT5 terminal."""

    def __init__(self, mt5_client: BaseMT5Client):
        self.client = mt5_client

    def fetch_closed_trades(
        self,
        from_date: datetime,
        to_date: datetime | None = None
    ) -> list[dict]:
        """
        Fetches historical deals between from_date and to_date (defaults to now UTC).
        Filters out non-trading deals and returns normalized API trade payload dicts.
        """
        end_dt = to_date or datetime.now(timezone.utc)
        
        # Ensure datetimes are naive UTC or localized correctly for MT5 API call
        if from_date.tzinfo is not None:
            from_date = from_date.astimezone(timezone.utc).replace(tzinfo=None)
        if end_dt.tzinfo is not None:
            end_dt = end_dt.astimezone(timezone.utc).replace(tzinfo=None)

        logger.info(
            "[HISTORY] Fetching MT5 history deals from %s to %s...",
            from_date.strftime("%Y-%m-%d %H:%M:%S"),
            end_dt.strftime("%Y-%m-%d %H:%M:%S")
        )

        raw_deals = self.client.get_history_deals(from_date, end_dt)
        if raw_deals is None:
            logger.warning("[HISTORY] MT5 history_deals_get returned None.")
            return []

        logger.info("[HISTORY] Retrieved %d raw deal records from MT5.", len(raw_deals))

        normalized_trades: list[dict] = []
        for deal in raw_deals:
            trade_dict = normalize_deal(deal)
            if trade_dict:
                normalized_trades.append(trade_dict)

        logger.info(
            "[HISTORY] Filtered and normalized %d closed trade exits.",
            len(normalized_trades)
        )
        return normalized_trades
