"""
Centralized Configuration Manager for TradeForge MT5 Connector.
Loads from environment variables (.env) with production-ready defaults.
"""

import os
from pathlib import Path
from dataclasses import dataclass
from dotenv import load_dotenv

# Load .env file from working directory if present
load_dotenv()


@dataclass
class Config:
    api_url: str = os.getenv("TRADEFORGE_API_URL", "http://localhost:3000").rstrip("/")
    connector_version: str = "1.0.0"
    
    # Sync Intervals (seconds)
    live_sync_interval_sec: float = float(os.getenv("LIVE_SYNC_INTERVAL_SEC", "2.0"))
    heartbeat_interval_sec: int = int(os.getenv("HEARTBEAT_INTERVAL_SEC", "60"))
    account_sync_interval_sec: int = int(os.getenv("ACCOUNT_SYNC_INTERVAL_SEC", "60"))
    history_sync_interval_sec: int = int(os.getenv("HISTORY_SYNC_INTERVAL_SEC", "300"))
    reconciliation_interval_sec: int = int(os.getenv("RECONCILIATION_INTERVAL_SEC", "3600"))

    
    # Ingestion Parameters
    initial_history_days: int = int(os.getenv("INITIAL_HISTORY_DAYS", "365"))
    incremental_overlap_minutes: int = int(os.getenv("INCREMENTAL_OVERLAP_MINUTES", "5"))
    batch_size: int = int(os.getenv("BATCH_SIZE", "500"))
    
    # MT5 Terminal Settings
    mt5_terminal_path: str | None = os.getenv("MT5_TERMINAL_PATH")
    
    # Retry & Network Settings
    request_timeout_sec: float = 30.0
    connect_timeout_sec: float = 10.0
    max_retry_delay_sec: int = 120
    
    # Log Level
    log_level: str = os.getenv("TRADEFORGE_LOG_LEVEL", "INFO").upper()
    
    # Storage Paths
    @property
    def data_dir(self) -> Path:
        base_dir = Path(os.getenv("LOCALAPPDATA", Path.home() / ".config")) / "TradeForge"
        base_dir.mkdir(parents=True, exist_ok=True)
        return base_dir

    @property
    def sqlite_db_path(self) -> Path:
        return self.data_dir / "connector_state.db"


# Global singleton instance
config = Config()
