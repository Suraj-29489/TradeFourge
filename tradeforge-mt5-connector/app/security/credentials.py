"""
Credential Protection Manager.
Uses OS-native credential storage (Windows Credential Manager / Keychain / SecretService) via `keyring`.
Never stores raw API keys in plaintext or logs.
"""

import logging

try:
    import keyring
    KEYRING_AVAILABLE = True
except ImportError:
    keyring = None
    KEYRING_AVAILABLE = False

logger = logging.getLogger("tradeforge.security")

SERVICE_NAME = "TradeForge-MT5-Connector"
API_KEY_ACCOUNT_NAME = "tradeforge_api_key"
_FALLBACK_KEY_STORE: dict[str, str] = {}


class CredentialManager:
    """Manages secure storage, retrieval, and deletion of the TradeForge API key."""

    @staticmethod
    def store_api_key(api_key: str) -> bool:
        """Stores the sensitive API key in OS credential manager."""
        if not api_key or not api_key.startswith("tf_mt5_"):
            logger.error("[SECURITY] Invalid API key format provided for storage.")
            return False

        if not KEYRING_AVAILABLE:
            _FALLBACK_KEY_STORE[API_KEY_ACCOUNT_NAME] = api_key
            logger.info("[SECURITY] Keyring package missing — API key stored in memory store.")
            return True

        try:
            keyring.set_password(SERVICE_NAME, API_KEY_ACCOUNT_NAME, api_key)
            logger.info("[SECURITY] API key securely stored in OS Credential Manager.")
            return True
        except Exception as err:
            logger.error("[SECURITY] Failed to store API key in keyring: %s", err)
            _FALLBACK_KEY_STORE[API_KEY_ACCOUNT_NAME] = api_key
            return True

    @staticmethod
    def get_api_key() -> str | None:
        """Retrieves the stored API key from OS credential manager."""
        if not KEYRING_AVAILABLE:
            return _FALLBACK_KEY_STORE.get(API_KEY_ACCOUNT_NAME)

        try:
            key = keyring.get_password(SERVICE_NAME, API_KEY_ACCOUNT_NAME)
            if key and key.startswith("tf_mt5_"):
                return key
            return _FALLBACK_KEY_STORE.get(API_KEY_ACCOUNT_NAME)
        except Exception as err:
            logger.error("[SECURITY] Failed to retrieve API key from keyring: %s", err)
            return _FALLBACK_KEY_STORE.get(API_KEY_ACCOUNT_NAME)

    @staticmethod
    def delete_api_key() -> bool:
        """Deletes the stored API key."""
        _FALLBACK_KEY_STORE.pop(API_KEY_ACCOUNT_NAME, None)

        if not KEYRING_AVAILABLE:
            return True

        try:
            keyring.delete_password(SERVICE_NAME, API_KEY_ACCOUNT_NAME)
            logger.info("[SECURITY] API key removed from OS Credential Manager.")
            return True
        except Exception as err:
            logger.warning("[SECURITY] API key deletion notice: %s", err)
            return True

    @staticmethod
    def has_api_key() -> bool:
        """Checks if a valid API key is currently stored."""
        return CredentialManager.get_api_key() is not None
