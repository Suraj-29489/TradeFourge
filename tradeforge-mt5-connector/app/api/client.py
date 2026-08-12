"""
HTTP API Client for TradeForge Backend.
Enforces HTTPS, Bearer token authentication, explicit timeouts, and exponential backoff retry.
NEVER logs raw API keys or passwords.
"""

import time
import logging
import httpx
from app.config import config
from app.security.credentials import CredentialManager
from app.errors import (
    NetworkError,
    AuthenticationError,
    AuthorizationError,
    ValidationError,
    RateLimitError,
    APIError,
)

logger = logging.getLogger("tradeforge.api")


class TradeForgeAPIClient:
    """HTTP Client wrapping httpx for communicate with TradeForge Backend API."""

    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or config.api_url).rstrip("/")
        self.timeout = httpx.Timeout(
            timeout=config.request_timeout_sec,
            connect=config.connect_timeout_sec
        )

    def _get_headers(self, requires_auth: bool = True) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": f"TradeForge-MT5-Connector/{config.connector_version}"
        }
        if requires_auth:
            api_key = CredentialManager.get_api_key()
            if not api_key:
                raise AuthenticationError("No TradeForge API key found in OS Credential Manager. Pairing required.")
            headers["Authorization"] = f"Bearer {api_key}"
        return headers

    def request(
        self,
        method: str,
        endpoint: str,
        json_data: dict | list | None = None,
        requires_auth: bool = True,
        max_retries: int = 3
    ) -> dict:
        """
        Executes HTTP request with exponential backoff and standard response envelope parsing.
        """
        url = f"{self.base_url}{endpoint}"
        retry_delay = 2.0

        for attempt in range(1, max_retries + 1):
            try:
                headers = self._get_headers(requires_auth=requires_auth)

                with httpx.Client(timeout=self.timeout, verify=True) as http_client:
                    response = http_client.request(
                        method=method.upper(),
                        url=url,
                        json=json_data,
                        headers=headers
                    )

                status = response.status_code

                # Handle Standard Error Statuses
                if status in (401, 403):
                    logger.error("[API] Authentication failed (%d) for endpoint %s", status, endpoint)
                    raise AuthenticationError(f"Authentication failed ({status}): Invalid or revoked API key.")

                if status == 400:
                    err_json = response.json() if response.content else {}
                    msg = err_json.get("error", {}).get("message", "Validation Error")
                    raise ValidationError(f"API Validation Error: {msg}", details=err_json)

                if status == 429:
                    err_json = response.json() if response.content else {}
                    reset_sec = err_json.get("error", {}).get("details", {}).get("reset_seconds", 60)
                    logger.warning("[API] Rate limited (429). Retrying in %d seconds...", reset_sec)
                    if attempt < max_retries:
                        time.sleep(min(reset_sec, config.max_retry_delay_sec))
                        continue
                    raise RateLimitError("Rate limit exceeded", reset_seconds=reset_sec)

                if status >= 500:
                    logger.warning("[API] Server error (%d) on attempt %d/%d for %s", status, attempt, max_retries, endpoint)
                    if attempt < max_retries:
                        time.sleep(retry_delay)
                        retry_delay = min(retry_delay * 2, config.max_retry_delay_sec)
                        continue
                    raise APIError(f"TradeForge server error ({status})", status_code=status)

                # Parse Response Envelope
                res_data = response.json()
                if isinstance(res_data, dict) and res_data.get("ok") is True:
                    return res_data.get("data", {})
                
                return res_data

            except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as net_err:
                logger.warning("[API] Network connection issue on attempt %d/%d: %s", attempt, max_retries, net_err)
                if attempt < max_retries:
                    time.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, config.max_retry_delay_sec)
                    continue
                raise NetworkError(f"Failed to connect to TradeForge API at {self.base_url}: {net_err}")
            except (AuthenticationError, ValidationError, RateLimitError, APIError):
                raise
            except Exception as err:
                raise APIError(f"Unexpected error communicating with API: {err}")

        raise NetworkError(f"Request to {endpoint} failed after {max_retries} attempts.")
