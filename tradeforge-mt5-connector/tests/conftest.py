"""
Pytest Fixtures for TradeForge MT5 Connector.
"""

import tempfile
import pytest
from pathlib import Path
from tests.mock_mt5 import MockMT5Client
from app.storage.database import ConnectorDatabase
from app.security.credentials import CredentialManager


@pytest.fixture
def mock_mt5():
    """Provides a fresh MockMT5Client instance."""
    return MockMT5Client()


@pytest.fixture
def temp_db():
    """Provides a ConnectorDatabase instance backed by a temporary file."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = Path(tmp.name)
    
    db = ConnectorDatabase(db_path=db_path)
    yield db

    try:
        db_path.unlink(missing_ok=True)
    except Exception:
        pass


@pytest.fixture(autouse=True)
def setup_mock_credentials(monkeypatch):
    """Mocks CredentialManager keyring functions during tests to avoid modifying real OS credentials."""
    stored_keys = {}

    def mock_store(key: str) -> bool:
        stored_keys["key"] = key
        return True

    def mock_get() -> str | None:
        return stored_keys.get("key", "tf_mt5_mock_test_key_1234567890abcdef")

    def mock_delete() -> bool:
        stored_keys.pop("key", None)
        return True

    def mock_has() -> bool:
        return "key" in stored_keys or True

    monkeypatch.setattr(CredentialManager, "store_api_key", mock_store)
    monkeypatch.setattr(CredentialManager, "get_api_key", mock_get)
    monkeypatch.setattr(CredentialManager, "delete_api_key", mock_delete)
    monkeypatch.setattr(CredentialManager, "has_api_key", mock_has)
