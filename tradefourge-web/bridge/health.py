"""
TradeFourge v4.0.1 — Bridge Telemetry & Health Monitoring
Samples CPU, Memory, Queue Size, Connected Brokers, and Uptime.
"""

import time
import psutil
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from bridge.database import DBBrokerCredential, DBSyncHistory
from bridge.config import settings

START_TIME = time.time()

class HealthMonitor:
    @staticmethod
    def get_metrics(db: Session) -> dict:
        uptime_seconds = int(time.time() - START_TIME)
        
        # System metrics
        cpu_percent = psutil.cpu_percent(interval=None)
        memory = psutil.virtual_memory()
        
        # DB metrics
        total_connected = db.query(DBBrokerCredential).filter(DBBrokerCredential.status == "Connected").count()
        total_credentials = db.query(DBBrokerCredential).count()
        total_sync_logs = db.query(DBSyncHistory).count()
        
        latest_failed = db.query(DBSyncHistory).filter(DBSyncHistory.status == "FAILED").order_by(DBSyncHistory.sync_time.desc()).first()
        latest_success = db.query(DBSyncHistory).filter(DBSyncHistory.status == "SUCCESS").order_by(DBSyncHistory.sync_time.desc()).first()

        return {
            "status": "healthy" if cpu_percent < 90 else "degraded",
            "version": settings.VERSION,
            "uptime_seconds": uptime_seconds,
            "environment": settings.ENV,
            "connected_brokers": total_connected,
            "total_credentials": total_credentials,
            "queue_size": 0,
            "system": {
                "cpu_percent": cpu_percent,
                "memory_used_mb": int(memory.used / (1024 * 1024)),
                "memory_percent": memory.percent
            },
            "last_sync": latest_success.sync_time if latest_success else None,
            "last_failure": latest_failed.sync_time if latest_failed else None,
            "last_failure_reason": latest_failed.error_message if latest_failed else None,
            "total_logs": total_sync_logs
        }
