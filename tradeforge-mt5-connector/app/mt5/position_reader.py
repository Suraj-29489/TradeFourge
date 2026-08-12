"""
Position Reader (Read-Only).
Reads current open positions for temporary live-state tracking.
STRICT RULE: Does NOT store floating P/L snapshots into persistent trades database.
"""

import logging
from app.mt5.client import BaseMT5Client

logger = logging.getLogger("tradeforge.mt5.positions")


class PositionReader:
    """Reads active open positions from MetaTrader 5 (read-only)."""

    def __init__(self, mt5_client: BaseMT5Client):
        self.client = mt5_client

    def read_open_positions(self) -> list[dict]:
        """
        Reads open positions from MT5 and normalizes for live-state transport.
        Returns empty list if no positions are open or client unavailable.
        """
        raw_positions = self.client.get_positions()
        if not raw_positions:
            return []

        normalized = []
        for pos in raw_positions:
            pos_dict = pos if isinstance(pos, dict) else pos._asdict()
            normalized.append({
                "ticket": str(pos_dict.get("ticket", "")),
                "symbol": str(pos_dict.get("symbol", "")),
                "type": "BUY" if pos_dict.get("type") == 0 else "SELL",
                "volume": float(pos_dict.get("volume", 0.0)),
                "open_price": float(pos_dict.get("price_open", 0.0)),
                "current_price": float(pos_dict.get("price_current", 0.0)),
                "sl": float(pos_dict.get("sl", 0.0)) if pos_dict.get("sl") else None,
                "tp": float(pos_dict.get("tp", 0.0)) if pos_dict.get("tp") else None,
                "profit": float(pos_dict.get("profit", 0.0)),
                "swap": float(pos_dict.get("swap", 0.0)),
                "magic": int(pos_dict.get("magic", 0)) if pos_dict.get("magic") else None,
                "comment": str(pos_dict.get("comment", "")) or None
            })

        logger.debug("[POSITIONS] Discovered %d active open positions.", len(normalized))
        return normalized
