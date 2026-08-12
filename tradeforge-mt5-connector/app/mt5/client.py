"""
Dedicated MT5 Connection Client.
Provides a strict read-only abstraction over the MetaTrader 5 Python package.
DOES NOT contain trade execution functions (order_send, order_check, position modification).
DOES NOT contain HTTP/API calls to TradeForge (keeps MT5 layer decoupled).
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from app.config import config
from app.errors import MT5Error, MT5OfflineError

logger = logging.getLogger("tradeforge.mt5")

try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False
    mt5 = None


class BaseMT5Client(ABC):
    """Abstract interface for MT5 interactions to support mocking in tests."""

    @abstractmethod
    def initialize(self, path: str | None = None) -> bool:
        pass

    @abstractmethod
    def shutdown(self) -> None:
        pass

    @abstractmethod
    def is_connected(self) -> bool:
        pass

    @abstractmethod
    def get_terminal_info(self) -> dict | None:
        pass

    @abstractmethod
    def get_account_info(self) -> dict | None:
        pass

    @abstractmethod
    def get_history_deals(self, from_date: datetime, to_date: datetime) -> list | None:
        pass

    @abstractmethod
    def get_positions(self) -> list | None:
        pass

    @abstractmethod
    def get_last_error(self) -> tuple[int, str]:
        pass


class MT5Client(BaseMT5Client):
    """Concrete implementation of BaseMT5Client using MetaTrader5 package."""

    def __init__(self, terminal_path: str | None = None):
        self.terminal_path = terminal_path or config.mt5_terminal_path
        self._initialized = False

    def initialize(self, path: str | None = None) -> bool:
        """Initializes connection to MT5 terminal."""
        if not MT5_AVAILABLE:
            logger.warning("[MT5] MetaTrader5 Python package is not installed.")
            return False

        init_path = path or self.terminal_path
        
        try:
            if init_path:
                logger.info("[MT5] Initializing MT5 terminal from path: %s", init_path)
                success = mt5.initialize(path=init_path)
            else:
                logger.info("[MT5] Initializing MT5 terminal with auto-detection...")
                success = mt5.initialize()

            if success:
                self._initialized = True
                terminal_info = mt5.terminal_info()
                if terminal_info:
                    logger.info(
                        "[MT5] Connected to MT5 Terminal v%s (Company: %s)",
                        getattr(terminal_info, "build", "unknown"),
                        getattr(terminal_info, "company", "unknown")
                    )
                return True
            else:
                err_code, err_msg = self.get_last_error()
                logger.warning("[MT5] Initialization failed: [%d] %s", err_code, err_msg)
                self._initialized = False
                return False
        except Exception as err:
            logger.error("[MT5] Unexpected exception during initialization: %s", err)
            self._initialized = False
            return False

    def shutdown(self) -> None:
        """Gracefully closes connection to MT5 terminal."""
        if MT5_AVAILABLE and self._initialized:
            try:
                mt5.shutdown()
                logger.info("[MT5] Terminal connection shut down.")
            except Exception as err:
                logger.warning("[MT5] Error during shutdown: %s", err)
        self._initialized = False

    def is_connected(self) -> bool:
        """Checks if MT5 client is currently initialized and connected."""
        if not MT5_AVAILABLE or not self._initialized:
            return False
        try:
            terminal_info = mt5.terminal_info()
            return terminal_info is not None and getattr(terminal_info, "connected", False)
        except Exception:
            return False

    def get_terminal_info(self) -> dict | None:
        if not self.is_connected():
            return None
        info = mt5.terminal_info()
        return info._asdict() if info else None

    def get_account_info(self) -> dict | None:
        """Retrieves currently logged in account details from MT5 terminal."""
        if not MT5_AVAILABLE:
            return None
        info = mt5.account_info()
        if info is None:
            return None
        return info._asdict()

    def get_history_deals(self, from_date: datetime, to_date: datetime) -> list | None:
        """Retrieves historical trade deals between from_date and to_date."""
        if not MT5_AVAILABLE:
            return None
        try:
            deals = mt5.history_deals_get(from_date, to_date)
            if deals is None:
                err_code, err_msg = self.get_last_error()
                logger.warning("[MT5] Failed to fetch history deals: [%d] %s", err_code, err_msg)
                return None
            return list(deals)
        except Exception as err:
            logger.error("[MT5] Exception fetching history deals: %s", err)
            return None

    def get_positions(self) -> list | None:
        """Retrieves active open positions from MT5 terminal (read-only)."""
        if not MT5_AVAILABLE:
            return None
        try:
            positions = mt5.positions_get()
            if positions is None:
                return []
            return [p._asdict() for p in positions]
        except Exception as err:
            logger.warning("[MT5] Failed to retrieve open positions: %s", err)
            return []

    def get_last_error(self) -> tuple[int, str]:
        if MT5_AVAILABLE:
            try:
                err = mt5.last_error()
                return (err[0], err[1]) if isinstance(err, tuple) and len(err) >= 2 else (0, str(err))
            except Exception:
                pass
        return (0, "Unknown error")
