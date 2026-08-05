"""
Pydantic Schemas for Credentials
"""

from typing import Optional
from pydantic import BaseModel, Field

class CredentialConnectRequest(BaseModel):
    user_id: str
    account_id: Optional[str] = None
    broker: str
    platform: str = "MetaTrader 5"
    account_name: str
    account_number: str
    server: str
    investor_password: str
    description: Optional[str] = None

class CredentialResponse(BaseModel):
    id: str
    user_id: str
    account_id: Optional[str] = None
    broker: str
    platform: str
    account_name: str
    account_number: str
    server: str
    status: str
    last_sync: Optional[str] = None
    auto_sync: bool = True
    total_trades: int = 0
    created_at: str

class SyncTriggerRequest(BaseModel):
    credential_id: str
    user_id: str
