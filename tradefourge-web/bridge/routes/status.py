"""
Telemetry, Metrics & Status Endpoints (/health, /status, /version, /jobs, /metrics)
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from bridge.database import get_db
from bridge.health import HealthMonitor
from bridge.config import settings

router = APIRouter(prefix="", tags=["Health & Monitoring"])

@router.get("/health")
def get_health(db: Session = Depends(get_db)):
    metrics = HealthMonitor.get_metrics(db)
    return {
        "status": metrics["status"],
        "version": settings.VERSION,
        "environment": settings.ENV
    }

@router.get("/status")
def get_status(db: Session = Depends(get_db)):
    return HealthMonitor.get_metrics(db)

@router.get("/version")
def get_version():
    return {
        "version": settings.VERSION,
        "name": settings.PROJECT_NAME,
        "python": "3.12+"
    }

@router.get("/jobs")
def get_jobs(db: Session = Depends(get_db)):
    metrics = HealthMonitor.get_metrics(db)
    return {
        "running_jobs": 0,
        "scheduled_jobs": 1,
        "total_credentials": metrics["total_credentials"],
        "connected_brokers": metrics["connected_brokers"]
    }

@router.get("/metrics")
def get_metrics(db: Session = Depends(get_db)):
    return HealthMonitor.get_metrics(db)
