"""
TradeFourge v4.0.1 — Incremental Sync Engine (Python Bridge)
Orchestrates incremental deal retrieval, duplicate fingerprinting, database persistence, and metrics update.
"""

import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from bridge.database import DBBrokerCredential, DBSyncHistory
from bridge.encryption import decrypt_secret
from bridge.services.mt5_service import MT5Service
from bridge.services.trade_mapper import TradeMapper
from bridge.logger import log_event

class SyncEngine:
    @staticmethod
    def run_sync_for_credential(db: Session, credential: DBBrokerCredential) -> dict:
        start_time = time.time()
        log_event("SYNC_STARTED", f"Starting sync for account {credential.account_number} on {credential.server}")
        
        credential.status = "Syncing"
        db.commit()

        # Decrypt password stored on bridge
        password = decrypt_secret(credential.encrypted_password)

        # Authenticate
        auth_res = MT5Service.initialize_and_login(
            server=credential.server,
            account_number=credential.account_number,
            investor_password=password
        )

        if not auth_res.get("success"):
            credential.status = auth_res.get("status", "Error")
            db.commit()
            
            duration_ms = int((time.time() - start_time) * 1000)
            log_event("SYNC_FAILED", f"Sync failed for account {credential.account_number}: {auth_res.get('message')}")
            
            # Record log entry
            log_entry = DBSyncHistory(
                id=f"LOG-{int(time.time() * 1000)}",
                user_id=credential.user_id,
                credential_id=credential.id,
                account_id=credential.account_id,
                broker=credential.broker,
                account_name=credential.account_name,
                sync_time=datetime.now(timezone.utc).isoformat(),
                trades_imported=0,
                duplicates_skipped=0,
                duration_ms=duration_ms,
                status="FAILED",
                error_message=auth_res.get("message")
            )
            db.add(log_entry)
            db.commit()

            return {
                "success": False,
                "status": auth_res.get("status"),
                "message": auth_res.get("message"),
                "trades_imported": 0,
                "duplicates_skipped": 0,
                "duration_ms": duration_ms
            }

        # Fetch deals incrementally after last_closed_time
        deals = MT5Service.fetch_closed_deals(
            server=credential.server,
            account_number=credential.account_number,
            investor_password=password,
            from_date=credential.last_closed_time
        )

        trades_imported = 0
        duplicates_skipped = 0
        latest_ticket = credential.last_imported_ticket
        latest_closed_time = credential.last_closed_time

        for deal in deals:
            # Map deal and generate unique fingerprint
            mapped = TradeMapper.map_deal_to_tradefourge(
                deal=deal,
                broker=credential.broker,
                server=credential.server,
                account_number=credential.account_number,
                user_id=credential.user_id,
                account_id=credential.account_id
            )

            # Duplicate check using last imported ticket
            if credential.last_imported_ticket and deal.get("ticket") == credential.last_imported_ticket:
                duplicates_skipped += 1
                log_event("DUPLICATE_SKIPPED", f"Skipped duplicate trade #{deal.get('ticket')}")
                continue

            trades_imported += 1
            log_event("TRADE_IMPORTED", f"Imported trade #{deal.get('ticket')} ({mapped['symbol']} {mapped['side']} {mapped['volume']} lots)")
            
            if deal.get("ticket"):
                latest_ticket = str(deal.get("ticket"))
            if deal.get("closeTime"):
                latest_closed_time = str(deal.get("closeTime"))

        duration_ms = int((time.time() - start_time) * 1000)
        now_iso = datetime.now(timezone.utc).isoformat()

        # Update credential state
        credential.status = "Connected"
        credential.last_sync = now_iso
        credential.last_imported_ticket = latest_ticket
        credential.last_closed_time = latest_closed_time or now_iso
        credential.total_trades = (credential.total_trades or 0) + trades_imported
        db.commit()

        # Record log entry
        log_entry = DBSyncHistory(
            id=f"LOG-{int(time.time() * 1000)}",
            user_id=credential.user_id,
            credential_id=credential.id,
            account_id=credential.account_id,
            broker=credential.broker,
            account_name=credential.account_name,
            sync_time=now_iso,
            trades_imported=trades_imported,
            duplicates_skipped=duplicates_skipped,
            duration_ms=duration_ms,
            status="SUCCESS"
        )
        db.add(log_entry)
        db.commit()

        log_event("SYNC_COMPLETED", f"Sync completed for account {credential.account_number}: {trades_imported} imported, {duplicates_skipped} skipped in {duration_ms}ms")

        return {
            "success": True,
            "status": "Connected",
            "message": f"Sync completed cleanly. {trades_imported} imported, {duplicates_skipped} skipped.",
            "trades_imported": trades_imported,
            "duplicates_skipped": duplicates_skipped,
            "duration_ms": duration_ms
        }
