"""
Dataclass Models for Local SQLite Operational State.
"""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class ConnectorConfig:
    connector_id: str | None
    api_url: str
    paired_at: str | None


@dataclass
class SyncState:
    account_number: str
    last_history_sync: str | None
    last_successful_sync: str | None
    last_sync_status: str
    total_synced_deals: int


@dataclass
class KnownAccount:
    account_number: str
    server: str
    broker: str
    currency: str
    last_seen: str


@dataclass
class SyncResult:
    batch_id: str
    account_number: str
    inserted_count: int
    duplicate_count: int
    error_count: int
    synced_at: str
