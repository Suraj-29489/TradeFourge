"""
MT5 Deal Normalizer.
Transforms raw MT5 deal tuple/dict objects into the Phase 2/3 API schema.
Filters out non-trading operations (deposits, withdrawals, balance adjustments).
Preserves deal tickets, UTC timestamps, and exact financial precision.
"""

import logging
from datetime import datetime, timezone

logger = logging.getLogger("tradeforge.mt5.normalizer")

# MT5 Deal Type Constants (ENUM_DEAL_TYPE)
DEAL_TYPE_BUY = 0
DEAL_TYPE_SELL = 1
DEAL_TYPE_BALANCE = 2
DEAL_TYPE_CREDIT = 3

# MT5 Deal Entry Constants (ENUM_DEAL_ENTRY)
DEAL_ENTRY_IN = 0
DEAL_ENTRY_OUT = 1
DEAL_ENTRY_INOUT = 2
DEAL_ENTRY_OUT_BY = 3


def is_trade_deal(deal: dict | object) -> bool:
    """
    Determines if an MT5 deal is a completed trading exit deal.
    Only position exit deals (DEAL_ENTRY_OUT / INOUT / OUT_BY) with BUY/SELL type are valid closed trades.
    Filters out deposits, withdrawals, credit adjustments, and entry-only deals.
    """
    deal_dict = deal if isinstance(deal, dict) else deal._asdict()
    
    deal_type = deal_dict.get("type")
    deal_entry = deal_dict.get("entry")
    
    # Must be BUY or SELL operation
    if deal_type not in (DEAL_TYPE_BUY, DEAL_TYPE_SELL):
        return False

    # Must be position exit or reversal (DEAL_ENTRY_OUT, INOUT, OUT_BY)
    if deal_entry not in (DEAL_ENTRY_OUT, DEAL_ENTRY_INOUT, DEAL_ENTRY_OUT_BY):
        return False

    return True


def normalize_deal(deal: dict | object) -> dict | None:
    """
    Normalizes a raw MT5 deal object into a TradeForge MT5TradeBatchPayload dict.
    Returns None if the deal is not a valid closed trade.
    """
    if not is_trade_deal(deal):
        return None

    d = deal if isinstance(deal, dict) else deal._asdict()

    deal_id = str(d.get("ticket") or d.get("deal_id") or "")
    if not deal_id:
        return None

    order_id = str(d.get("order", "")) if d.get("order") else None
    position_id = str(d.get("position_id", "")) if d.get("position_id") else None
    symbol = str(d.get("symbol", "UNKNOWN")).strip()
    
    # MT5 side: In MT5, an exit deal_type of BUY means closing a SELL position (or buying to exit),
    # but the original position side was SELL. However, TradeForge trade side is normalized:
    # If exit deal is BUY (0), position closed was SELL. If exit deal is SELL (1), position closed was BUY.
    deal_type = d.get("type")
    side = "SELL" if deal_type == DEAL_TYPE_BUY else "BUY"

    volume = float(d.get("volume", 0.0))
    close_price = float(d.get("price", 0.0))
    open_price = float(d.get("price_position_open") or close_price)  # Default to close_price if open not attached

    # Timestamps -> UTC ISO 8601
    close_time_sec = d.get("time")
    if close_time_sec:
        close_dt = datetime.fromtimestamp(close_time_sec, tz=timezone.utc)
        close_time_iso = close_dt.isoformat().replace("+00:00", "Z")
    else:
        close_time_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # Entry time estimate if available
    open_time_sec = d.get("time_msc", 0) // 1000 if d.get("time_msc") else close_time_sec
    open_dt = datetime.fromtimestamp(open_time_sec, tz=timezone.utc) if open_time_sec else close_dt
    open_time_iso = open_dt.isoformat().replace("+00:00", "Z")

    profit = float(d.get("profit", 0.0))
    commission = float(d.get("commission", 0.0))
    swap = float(d.get("swap", 0.0))
    magic_number = int(d.get("magic")) if d.get("magic") else None
    comment = str(d.get("comment", "")).strip() or None

    return {
        "deal_id": deal_id,
        "order_id": order_id,
        "position_id": position_id,
        "symbol": symbol,
        "side": side,
        "volume": volume,
        "open_price": open_price,
        "close_price": close_price,
        "open_time": open_time_iso,
        "close_time": close_time_iso,
        "profit": profit,
        "commission": commission,
        "swap": swap,
        "magic_number": magic_number,
        "comment": comment
    }
