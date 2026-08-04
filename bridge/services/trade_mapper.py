"""
TradeFourge v4.0.1 — Trade Mapper & Fingerprint Engine
Normalizes raw MT5 deals to standard TradeFourge schema and generates unique duplicate protection fingerprints.
"""

import hashlib
from typing import Dict, Any

class TradeMapper:
    @staticmethod
    def generate_fingerprint(broker: str, server: str, account_number: str, ticket: str) -> str:
        """
        Generates unique trade fingerprint: Broker + Server + Account Number + Ticket
        """
        raw_key = f"{broker.strip().upper()}:{server.strip().upper()}:{account_number.strip()}:{ticket.strip()}"
        return hashlib.sha256(raw_key.encode('utf-8')).hexdigest()

    @staticmethod
    def map_deal_to_tradefourge(deal: Dict[str, Any], broker: str, server: str, account_number: str, user_id: str, account_id: str = None) -> Dict[str, Any]:
        """Normalizes MT5 deal object into standard TradeFourge Cloud DB format."""
        profit = deal.get("profit", 0.0)
        commission = deal.get("commission", 0.0)
        swap = deal.get("swap", 0.0)
        net_profit = profit + commission + swap

        if net_profit > 0.001:
            outcome = "WIN"
        elif net_profit < -0.001:
            outcome = "LOSS"
        else:
            outcome = "BREAKEVEN"

        fingerprint = TradeMapper.generate_fingerprint(broker, server, account_number, deal.get("ticket", ""))

        return {
            "fingerprint": fingerprint,
            "user_id": user_id,
            "account_id": account_id,
            "ticket": str(deal.get("ticket", "")),
            "symbol": str(deal.get("symbol", "")).upper(),
            "side": deal.get("side", "BUY"),
            "volume": float(deal.get("volume", 0.0)),
            "open_price": float(deal.get("openPrice", 0.0)),
            "close_price": float(deal.get("closePrice", 0.0)) if deal.get("closePrice") is not None else None,
            "stop_loss": float(deal.get("stopLoss", 0.0)) if deal.get("stopLoss") is not None else None,
            "take_profit": float(deal.get("takeProfit", 0.0)) if deal.get("takeProfit") is not None else None,
            "open_time": deal.get("openTime"),
            "close_time": deal.get("closeTime"),
            "profit": profit,
            "commission": commission,
            "swap": swap,
            "net_profit": net_profit,
            "outcome": outcome,
            "source": "api", # Cloud Live Sync Source
            "magic_number": deal.get("magicNumber"),
            "comment": deal.get("comment", "Synchronized via MT5 Bridge"),
            "notes": f"Exness MT5 Deal #{deal.get('ticket')} on {server}",
            "strategy": "MT5 Automated Sync",
        }
