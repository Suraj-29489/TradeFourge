"""
Security Tests — Verifies Secret Scrubbing and Key Storage Protection.
"""

import logging
import unittest
from app.logging_config import SecretScrubbingFilter


class TestCredentials(unittest.TestCase):

    def test_secret_scrubbing_filter(self):
        filter_obj = SecretScrubbingFilter()

        # Test raw API key in log message string
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="", lineno=1,
            msg="Authenticated using key tf_mt5_a1b2c3d4e5f678901234567890abcdef1234567890abcdef successfully.",
            args=(), exc_info=None
        )
        filter_obj.filter(record)
        self.assertNotIn("tf_mt5_a1b2c3d4e5f678901234567890abcdef1234567890abcdef", record.msg)
        self.assertIn("tf_mt5_***[REDACTED]***", record.msg)

        # Test Bearer header in log message string
        record_bearer = logging.LogRecord(
            name="test", level=logging.INFO, pathname="", lineno=1,
            msg="Header set to Bearer tf_mt5_a1b2c3d4e5f67890",
            args=(), exc_info=None
        )
        filter_obj.filter(record_bearer)
        self.assertNotIn("tf_mt5_a1b2c3d4e5f67890", record_bearer.msg)
        self.assertIn("Bearer ***[REDACTED]***", record_bearer.msg)


if __name__ == "__main__":
    unittest.main()
