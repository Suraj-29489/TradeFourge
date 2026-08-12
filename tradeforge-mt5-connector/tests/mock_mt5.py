"""
Mock MT5 Client Implementation for Unit and Integration Testing.
Simulates MT5 account info, deal history, offline state, and reconnection without requiring a real terminal.
"""

from datetime import datetime, timezone
from app.mt5.client import BaseMT5Client


class MockMT5Client(BaseMT5Client):
    """Mock implementation of BaseMT5Client for automated tests."""

    def __init__(
        self,
        is_online: bool = True,
        account_number: int = 267588210,
        server: str = "Exness-MT5Real39",
        broker: str = "Exness",
        currency: str = "USD",
        balance: float = 1000.0,
        deals: list | None = None
    ):
        self._online = is_online
        self.account_number = account_number
        self.server = server
        self.broker = broker
        self.currency = currency
        self.balance = balance
        self.deals = deals if deals is not None else self._generate_default_deals()

    def initialize(self, path: str | None = None) -> bool:
        return self._online

    def shutdown(self) -> None:
        self._online = False

    def is_connected(self) -> bool:
        return self._online

    def set_online(self, online: bool):
        self._online = online

    def get_terminal_info(self) -> dict | None:
        if not self._online:
            return None
        return {
            "connected": True,
            "build": 4150,
            "company": self.broker,
            "name": "MetaTrader 5"
        }

    def get_account_info(self) -> dict | None:
        if not self._online:
            return None
        return {
            "login": self.account_number,
            "trade_mode": 2,  # Live
            "server": self.server,
            "currency": self.currency,
            "company": self.broker,
            "leverage": 2000,
            "balance": self.balance,
            "equity": self.balance + 50.0,
            "margin_free": self.balance - 20.0,
            "margin": 20.0,
            "margin_level": 5000.0,
            "name": f"Mock Account {self.account_number}"
        }

    def get_history_deals(self, from_date: datetime, to_date: datetime) -> list | None:
        if not self._online:
            return None

        # Filter mock deals within date range
        filtered = []
        for deal in self.deals:
            d_time = deal.get("time") if isinstance(deal, dict) else deal.time
            dt = datetime.fromtimestamp(d_time, tz=timezone.utc).replace(tzinfo=None)
            
            from_naive = from_date.replace(tzinfo=None) if from_date.tzinfo else from_date
            to_naive = to_date.replace(tzinfo=None) if to_date.tzinfo else to_date

            if from_naive <= dt <= to_naive:
                filtered.append(deal)

        return filtered

    def get_positions(self) -> list | None:
        if not self._online:
            return []
        return []

    def get_last_error(self) -> tuple[int, str]:
        return (0, "OK") if self._online else (1, "MT5 Offline")

    def _generate_default_deals(self) -> list:
        now_ts = int(datetime.now(timezone.utc).timestamp())
        return [
            {
                "ticket": 1001,
                "order": 5001,
                "position_id": 9001,
                "symbol": "EURUSD",
                "type": 0,  # BUY exit
                "entry": 1,  # DEAL_ENTRY_OUT
                "volume": 0.1,
                "price": 1.0850,
                "price_position_open": 1.0800,
                "time": now_ts - 60,
                "profit": 50.0,
                "commission": -1.5,
                "swap": -0.5,
                "magic": 12345,
                "comment": "Mock Exit Win"
            },
            {
                "ticket": 1002,
                "order": 5002,
                "position_id": 9002,
                "symbol": "XAUUSD",
                "type": 1,  # SELL exit
                "entry": 1,  # DEAL_ENTRY_OUT
                "volume": 0.05,
                "price": 2350.0,
                "price_position_open": 2360.0,
                "time": now_ts - 30,
                "profit": -50.0,
                "commission": -1.0,
                "swap": 0.0,
                "magic": 0,
                "comment": "Mock Exit Loss"
            },
            {
                "ticket": 9999,
                "order": 0,
                "position_id": 0,
                "symbol": "",
                "type": 2,  # DEAL_TYPE_BALANCE
                "entry": 0,
                "volume": 0.0,
                "price": 0.0,
                "time": now_ts - 120,
                "profit": 1000.0,
                "commission": 0.0,
                "swap": 0.0,
                "comment": "Deposit"
            }
        ]
