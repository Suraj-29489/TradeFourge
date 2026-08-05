"""
Sync Execution & History Endpoints (/sync, /history)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from bridge.database import get_db, DBBrokerCredential, DBSyncHistory
from bridge.models.trade import SyncExecutionResult
from bridge.services.sync_engine import SyncEngine
from bridge.services.security import verify_token
from bridge.logger import log_event

router = APIRouter(prefix="", tags=["Synchronization"])

@router.post("/sync", response_model=SyncExecutionResult)
def trigger_sync(credential_id: str, user_id: str, db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    cred = db.query(DBBrokerCredential).filter(
        DBBrokerCredential.id == credential_id,
        DBBrokerCredential.user_id == user_id
    ).first()

    if not cred:
        raise HTTPException(status_code=404, detail="Broker credential not found.")

    res = SyncEngine.run_sync_for_credential(db, cred)

    return SyncExecutionResult(
        success=res.get("success", False),
        status=res.get("status", "Error"),
        message=res.get("message", ""),
        trades_imported=res.get("trades_imported", 0),
        duplicates_skipped=res.get("duplicates_skipped", 0),
        duration_ms=res.get("duration_ms", 0)
    )

@router.get("/history")
def get_sync_history(user_id: str, db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    logs = db.query(DBSyncHistory).filter(DBSyncHistory.user_id == user_id).order_by(DBSyncHistory.sync_time.desc()).limit(100).all()
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "credential_id": l.credential_id,
            "account_id": l.account_id,
            "broker": l.broker,
            "account_name": l.account_name,
            "sync_time": l.sync_time,
            "trades_imported": l.trades_imported,
            "duplicates_skipped": l.duplicates_skipped,
            "duration_ms": l.duration_ms,
            "status": l.status,
            "error_message": l.error_message,
        } for l in logs
    ]
