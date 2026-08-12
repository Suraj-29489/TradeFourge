"""
Tests for TradeForge API HTTP Client.
"""

import unittest
from unittest.mock import MagicMock, patch
from app.api.client import TradeForgeAPIClient
from app.security.credentials import CredentialManager
from app.errors import AuthenticationError, RateLimitError, APIError


class TestAPIClient(unittest.TestCase):

    def setUp(self):
        CredentialManager.store_api_key("tf_mt5_test_api_key_1234567890abcdef")

    def tearDown(self):
        CredentialManager.delete_api_key()

    def test_api_client_header_injection(self):
        client = TradeForgeAPIClient(base_url="http://test.tradeforge.local")
        headers = client._get_headers(requires_auth=True)

        self.assertIn("Authorization", headers)
        self.assertTrue(headers["Authorization"].startswith("Bearer tf_mt5_"))
        self.assertEqual(headers["Content-Type"], "application/json")

    def test_api_client_auth_error_handling(self):
        client = TradeForgeAPIClient(base_url="http://test.tradeforge.local")

        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.content = b'{"ok":false,"error":{"message":"Unauthorized"}}'

        with patch("httpx.Client.request", return_value=mock_response):
            with self.assertRaises(AuthenticationError):
                client.request("POST", "/api/mt5/heartbeat", json_data={}, max_retries=1)

    def test_api_client_rate_limit_error_handling(self):
        client = TradeForgeAPIClient(base_url="http://test.tradeforge.local")

        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.json.return_value = {
            "ok": False,
            "error": {"code": "RATE_LIMITED", "details": {"reset_seconds": 10}}
        }

        with patch("httpx.Client.request", return_value=mock_response):
            with self.assertRaises(RateLimitError):
                client.request("POST", "/api/mt5/trades/batch", json_data={}, max_retries=1)


if __name__ == "__main__":
    unittest.main()
