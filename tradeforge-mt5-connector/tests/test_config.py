"""
Tests for Configuration Management.
"""

import unittest
from app.config import Config


class TestConfig(unittest.TestCase):
    def test_config_defaults(self):
        cfg = Config()
        self.assertEqual(cfg.api_url, "http://localhost:3000")
        self.assertEqual(cfg.connector_version, "1.0.0")
        self.assertEqual(cfg.heartbeat_interval_sec, 60)
        self.assertEqual(cfg.batch_size, 500)
        self.assertEqual(cfg.request_timeout_sec, 30.0)

    def test_config_sqlite_path(self):
        cfg = Config()
        self.assertEqual(cfg.sqlite_db_path.name, "connector_state.db")


if __name__ == "__main__":
    unittest.main()
