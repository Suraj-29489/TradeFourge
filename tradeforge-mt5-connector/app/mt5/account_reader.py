"""
Account Information Reader.
Reads raw account properties from MT5 and normalizes them into Phase 2/3 API schema.
Strictly preserves source currency (e.g. 'USC' for Cent accounts without USD conversion).
"""

import logging
from app.mt5.client import BaseMT5Client

logger = logging.getLogger("tradeforge.mt5.account")


class AccountReader:
    """Reads and normalizes account metadata from MetaTrader 5."""

    def __init__(self, mt5_client: BaseMT5Client):
        self.client = mt5_client

    def read_account(self) -> dict | None:
        """
        Fetches current MT5 account details and maps to MT5AccountSyncPayload dict.
        Returns None if no account is currently logged in.
        """
        raw_info = self.client.get_account_info()
        if not raw_info:
            logger.warning("[ACCOUNT] No active account logged in MT5.")
            return None

        login_num = str(raw_info.get("login", "")).strip()
        if not login_num or login_num == "0":
            logger.warning("[ACCOUNT] Invalid account login number retrieved.")
            return None

        server = str(raw_info.get("server", "MT5 Server")).strip()
        company = str(raw_info.get("company", "MetaTrader 5 Broker")).strip()
        currency = str(raw_info.get("currency", "USD")).strip()
        
        # Account Type heuristic from broker name or trade mode
        trade_mode = raw_info.get("trade_mode", 0)
        mode_str = "Live" if trade_mode == 2 else "Demo" if trade_mode == 0 else "Contest"
        
        account_name_raw = str(raw_info.get("name", "")).strip()
        if "cent" in currency.lower() or "usc" in currency.lower() or "cent" in server.lower():
            account_type = "Standard Cent"
        elif "pro" in server.lower() or "pro" in account_name_raw.lower():
            account_type = "Pro"
        elif "zero" in server.lower():
            account_type = "Zero"
        elif "raw" in server.lower():
            account_type = "Raw Spread"
        else:
            account_type = mode_str

        leverage_val = raw_info.get("leverage")
        leverage_str = f"1:{leverage_val}" if leverage_val else "1:100"

        balance = float(raw_info.get("balance", 0.0))
        equity = float(raw_info.get("equity", balance))
        free_margin = float(raw_info.get("margin_free", 0.0))
        margin = float(raw_info.get("margin", 0.0))
        margin_level = float(raw_info.get("margin_level", 0.0))

        payload = {
          "account_number": login_num,
          "server": server,
          "broker": company,
          "account_type": account_type,
          "currency": currency,  # PRESERVED AS-IS ('USC', 'USD', 'EUR')
          "leverage": leverage_str,
          "balance": balance,
          "equity": equity,
          "free_margin": free_margin,
          "margin": margin,
          "margin_level": margin_level,
          "name": account_name_raw or f"MT5 {login_num}"
        }

        logger.info(
            "[ACCOUNT] Discovered MT5 Account %s (%s) on %s — Balance: %.2f %s, Equity: %.2f %s",
            login_num, account_type, server, balance, currency, equity, currency
        )
        return payload
