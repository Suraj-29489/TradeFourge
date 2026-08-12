"""
Custom Exceptions for TradeForge MT5 Connector.
Enables precise error classification and structured retry handling.
"""


class ConnectorError(Exception):
    """Base exception for all connector errors."""

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class MT5Error(ConnectorError):
    """Raised when MT5 initialization, terminal connection, or MT5 API fails."""
    pass


class MT5OfflineError(MT5Error):
    """Raised specifically when MT5 application or terminal is unreachable/offline."""
    pass


class NetworkError(ConnectorError):
    """Raised on HTTP transport/network failures."""
    pass


class AuthenticationError(ConnectorError):
    """Raised when API key is missing, invalid, or revoked (HTTP 401/403)."""
    pass


class AuthorizationError(ConnectorError):
    """Raised when request lacks necessary permissions."""
    pass


class ValidationError(ConnectorError):
    """Raised when API payload validation fails (HTTP 400)."""
    pass


class APIError(ConnectorError):
    """Raised on TradeForge API server errors (HTTP 500, 502, 503, 504)."""
    
    def __init__(self, message: str, status_code: int = 500, details: dict | None = None):
        super().__init__(message, details)
        self.status_code = status_code


class RateLimitError(APIError):
    """Raised on HTTP 429 Rate Limit response."""

    def __init__(self, message: str = "Rate limit exceeded", reset_seconds: int = 60):
        super().__init__(message, status_code=429, details={"reset_seconds": reset_seconds})
        self.reset_seconds = reset_seconds


class DatabaseSyncError(ConnectorError):
    """Raised on local SQLite operational failures."""
    pass


class ConfigurationError(ConnectorError):
    """Raised when required configuration settings are missing or invalid."""
    pass
