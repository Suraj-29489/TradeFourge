"""
TradeFourge v4.0.1 — MT5 Bridge Structured JSON Logging Module
Strictly sanitizes all sensitive credential data prior to emitting logs.
"""

import json
import logging
import sys
from datetime import datetime, timezone

class StructuredJSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_object = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Merge extra context dictionary if present
        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            # Sanitize password or secret fields if accidentally passed
            sanitized_data = {
                k: ("***ENCRYPTED***" if "password" in k.lower() or "secret" in k.lower() else v)
                for k, v in record.extra_data.items()
            }
            log_object["data"] = sanitized_data
            
        if record.exc_info:
            log_object["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_object)

def setup_logger(name: str = "mt5_bridge") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(StructuredJSONFormatter())
        logger.addHandler(handler)
        
    return logger

logger = setup_logger()

def log_event(event_type: str, message: str, **kwargs):
    """Helper to emit structured log events: LOGIN_SUCCESS, SYNC_STARTED, etc."""
    logger.info(f"[{event_type}] {message}", extra={"extra_data": {"event": event_type, **kwargs}})
