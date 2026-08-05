"""
Pydantic Schemas for Trades & Sync Execution Results
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class MT5DealPayload(BaseModel):
    ticket: str
    order: Optional[str] = None
    symbol: str
    side: str # BUY / SELL
    volume: float
    openPrice: float
    closePrice: Optional[float] = None
    stopLoss: Optional[float] = None
    takeProfit: Optional[float] = None
    openTime: str
    closeTime: Optional[str] = None
    profit: float = 0.0
    commission: float = 0.0
    swap: float = 0.0
    magicNumber: Optional[int] = None
    comment: Optional[str] = None

class SyncExecutionResult(BaseModel):
    success: bool
    status: str
    message: str
    trades_imported: int = 0
    duplicates_skipped: int = 0
    duration_ms: int = 0
    details: Optional[Dict[str, Any]] = None
