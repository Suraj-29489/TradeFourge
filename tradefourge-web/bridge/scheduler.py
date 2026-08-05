"""
TradeFourge v4.0.1 — APScheduler Background Runner
Periodically executes live broker synchronization for auto_sync credentials.
"""

import time
from apscheduler.schedulers.background import BackgroundScheduler
from bridge.database import SessionLocal, DBBrokerCredential
from bridge.services.sync_engine import SyncEngine
from bridge.logger import log_event

scheduler = BackgroundScheduler()

def periodic_sync_job():
    """Background task running every 60s checking for active auto_sync credentials."""
    db = SessionLocal()
    try:
        credentials = db.query(DBBrokerCredential).filter(DBBrokerCredential.auto_sync == True).all()
        now = time.time()
        
        for cred in credentials:
            last_sync_ts = 0
            if cred.last_sync:
                try:
                    last_sync_ts = datetime.fromisoformat(cred.last_sync).timestamp()
                except Exception:
                    pass
            
            # 5 minute interval default
            if now - last_sync_ts >= 300:
                SyncEngine.run_sync_for_credential(db, cred)
    except Exception as e:
        log_event("SCHEDULER_ERROR", f"Scheduler tick error: {str(e)}")
    finally:
        db.close()

def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(periodic_sync_job, 'interval', seconds=60, id='live_sync_job', replace_existing=True)
        scheduler.start()
        log_event("SCHEDULER_STARTED", "APScheduler background runner started.")

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        log_event("SCHEDULER_STOPPED", "APScheduler background runner stopped.")
