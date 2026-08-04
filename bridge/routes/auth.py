"""
Auth & Credential Management Endpoints (/connect, /disconnect, /accounts)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from bridge.database import get_db, DBBrokerCredential
from bridge.models.credential import CredentialConnectRequest, CredentialResponse
from bridge.encryption import encrypt_secret
from bridge.services.mt5_service import MT5Service
from bridge.services.security import verify_token
from bridge.logger import log_event
import uuid

router = APIRouter(prefix="", tags=["Authentication & Credentials"])

@router.post("/connect", response_model=CredentialResponse)
def connect_account(req: CredentialConnectRequest, db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    # 1. Validate MT5 Credentials with MT5 Server
    auth_res = MT5Service.initialize_and_login(
        server=req.server,
        account_number=req.account_number,
        investor_password=req.investor_password
    )

    if not auth_res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=auth_res.get("message", "Authentication failed.")
        )

    # 2. Encrypt password before storing in bridge DB
    encrypted_pw = encrypt_secret(req.investor_password)

    # 3. Store or update credential locally inside Bridge DB
    existing = db.query(DBBrokerCredential).filter(
        DBBrokerCredential.user_id == req.user_id,
        DBBrokerCredential.account_number == req.account_number,
        DBBrokerCredential.server == req.server
    ).first()

    if existing:
        existing.account_name = req.account_name
        existing.encrypted_password = encrypted_pw
        existing.status = "Connected"
        db.commit()
        db.refresh(existing)
        cred = existing
    else:
        cred = DBBrokerCredential(
            id=f"cred-{uuid.uuid4().hex[:8]}",
            user_id=req.user_id,
            account_id=req.account_id,
            broker=req.broker,
            platform=req.platform,
            account_name=req.account_name,
            account_number=req.account_number,
            server=req.server,
            encrypted_password=encrypted_pw,
            status="Connected"
        )
        db.add(cred)
        db.commit()
        db.refresh(cred)

    log_event("CONNECT_SUCCESS", f"Connected account {req.account_number} on {req.server}")

    return CredentialResponse(
        id=cred.id,
        user_id=cred.user_id,
        account_id=cred.account_id,
        broker=cred.broker,
        platform=cred.platform,
        account_name=cred.account_name,
        account_number=cred.account_number,
        server=cred.server,
        status=cred.status,
        last_sync=cred.last_sync,
        auto_sync=cred.auto_sync,
        total_trades=cred.total_trades or 0,
        created_at=cred.created_at.isoformat() if cred.created_at else ""
    )

@router.post("/disconnect")
def disconnect_account(credential_id: str, user_id: str, db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    cred = db.query(DBBrokerCredential).filter(
        DBBrokerCredential.id == credential_id,
        DBBrokerCredential.user_id == user_id
    ).first()
    
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found.")

    db.delete(cred)
    db.commit()
    log_event("DISCONNECT_SUCCESS", f"Disconnected credential {credential_id}")
    return {"success": True, "message": "Credential disconnected cleanly."}

@router.get("/accounts")
def list_accounts(user_id: str, db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    creds = db.query(DBBrokerCredential).filter(DBBrokerCredential.user_id == user_id).all()
    return [
        CredentialResponse(
            id=c.id,
            user_id=c.user_id,
            account_id=c.account_id,
            broker=c.broker,
            platform=c.platform,
            account_name=c.account_name,
            account_number=c.account_number,
            server=c.server,
            status=c.status,
            last_sync=c.last_sync,
            auto_sync=c.auto_sync,
            total_trades=c.total_trades or 0,
            created_at=c.created_at.isoformat() if c.created_at else ""
        ) for c in creds
    ]
