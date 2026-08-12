"""
Terminal Detection Module.
Determines local MT5 installation, process execution state, and account login status.
Exposes discrete states: NOT_INSTALLED, NOT_RUNNING, INITIALIZING, CONNECTED, ACCOUNT_NOT_LOGGED_IN, ERROR.
"""

import logging
from enum import Enum
from app.mt5.client import BaseMT5Client, MT5_AVAILABLE

logger = logging.getLogger("tradeforge.mt5.detector")


class TerminalState(str, Enum):
    NOT_INSTALLED = "NOT_INSTALLED"
    NOT_RUNNING = "NOT_RUNNING"
    INITIALIZING = "INITIALIZING"
    CONNECTED = "CONNECTED"
    ACCOUNT_NOT_LOGGED_IN = "ACCOUNT_NOT_LOGGED_IN"
    ERROR = "ERROR"


class TerminalDetector:
    """Detects current MT5 terminal status and logged-in trading account status."""

    def __init__(self, mt5_client: BaseMT5Client):
        self.client = mt5_client

    def detect_status(self) -> tuple[TerminalState, str]:
        """
        Evaluates the system environment and MT5 client connection.
        Returns (TerminalState, detail_message).
        """
        if not MT5_AVAILABLE:
            return TerminalState.NOT_INSTALLED, "MetaTrader5 Python package not installed"

        try:
            acc_info = self.client.get_account_info()
            if acc_info is not None:
                login = acc_info.get("login")
                server = acc_info.get("server")
                if login and login > 0:
                    return TerminalState.CONNECTED, f"Account {login} logged in on {server}"
                else:
                    return TerminalState.ACCOUNT_NOT_LOGGED_IN, "MT5 running but no account logged in"

            # Check if terminal process is running but not connected
            term_info = self.client.get_terminal_info()
            if term_info is not None:
                if not term_info.get("connected"):
                    return TerminalState.NOT_RUNNING, "MT5 terminal process running but disconnected from broker"
                return TerminalState.ACCOUNT_NOT_LOGGED_IN, "MT5 connected to broker server but account login missing"

            return TerminalState.NOT_RUNNING, "MT5 terminal is not initialized or running"

        except Exception as err:
            logger.error("[DETECTOR] Error detecting MT5 status: %s", err)
            return TerminalState.ERROR, f"Detection error: {err}"
