"""
TradeFourge v4.0.1 — Bridge Database Storage Engine
Manages SQLite persistence for encrypted MT5 credentials, sync checkpoints, and local execution state.
"""

from sqlalchemy import create_engine, Column, String, Boolean, Integer, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timezone
from bridge.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DBBrokerCredential(Base):
    __tablename__ = "bridge_credentials"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    account_id = Column(String, nullable=True)
    broker = Column(String, nullable=False)
    platform = Column(String, default="MetaTrader 5")
    account_name = Column(String, nullable=False)
    account_number = Column(String, nullable=False)
    server = Column(String, nullable=False)
    encrypted_password = Column(String, nullable=False)
    status = Column(String, default="Connected")
    last_sync = Column(String, nullable=True)
    auto_sync = Column(Boolean, default=True)
    last_imported_ticket = Column(String, nullable=True)
    last_closed_time = Column(String, nullable=True)
    total_trades = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class DBSyncHistory(Base):
    __tablename__ = "bridge_sync_history"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    credential_id = Column(String, nullable=True)
    account_id = Column(String, nullable=True)
    broker = Column(String, nullable=False)
    account_name = Column(String, nullable=False)
    sync_time = Column(String, nullable=False)
    trades_imported = Column(Integer, default=0)
    duplicates_skipped = Column(Integer, default=0)
    duration_ms = Column(Integer, default=0)
    status = Column(String, nullable=False)
    error_message = Column(Text, nullable=True)
    log_details = Column(Text, nullable=True)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
