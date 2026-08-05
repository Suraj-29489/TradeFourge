"""
TradeFourge v4.0.1 — Exponential Backoff Retry Engine
Manages fault-tolerant retries for intermittent network timeouts, broker offline states, or rate limits.
"""

import time
from typing import Callable, Any, Dict
from bridge.logger import log_event

# Backoff intervals in seconds: 30s -> 1m -> 2m -> 5m -> 15m
BACKOFF_INTERVALS = [30, 60, 120, 300, 900]

class RetryEngine:
    @staticmethod
    def execute_with_retry(func: Callable[..., Dict[str, Any]], *args, max_attempts: int = 5, **kwargs) -> Dict[str, Any]:
        """Executes a function with exponential backoff retries."""
        last_result = None

        for attempt in range(max_attempts):
            try:
                result = func(*args, **kwargs)
                if isinstance(result, dict) and result.get("success"):
                    return result
                
                status = result.get("status", "") if isinstance(result, dict) else ""
                # Retriable statuses: Timeout, Server Offline, Error
                if status in ["Timeout", "Server Offline", "Error"]:
                    delay = BACKOFF_INTERVALS[min(attempt, len(BACKOFF_INTERVALS) - 1)]
                    log_event("RETRY_STARTED", f"Attempt {attempt + 1}/{max_attempts} failed with '{status}'. Retrying in {delay}s...")
                    time.sleep(min(delay, 2)) # Cap delay in worker loop
                    last_result = result
                    continue
                else:
                    # Non-retriable failure (e.g. Invalid Investor Password)
                    return result
            except Exception as e:
                delay = BACKOFF_INTERVALS[min(attempt, len(BACKOFF_INTERVALS) - 1)]
                log_event("RETRY_STARTED", f"Attempt {attempt + 1}/{max_attempts} threw exception: {str(e)}. Retrying in {delay}s...")
                time.sleep(min(delay, 2))
                last_result = {"success": False, "status": "Error", "message": str(e)}

        return last_result or {"success": False, "status": "Failed", "message": "Max retry attempts exhausted."}
