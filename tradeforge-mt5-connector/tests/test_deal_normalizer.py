"""
Tests for MT5 Deal Normalization and Filtering Logic.
"""

import unittest
from app.mt5.deal_normalizer import normalize_deal, is_trade_deal


class TestDealNormalizer(unittest.TestCase):

    def test_is_trade_deal_filters_balance_deposit(self):
        balance_deal = {
            "ticket": 9999,
            "type": 2,  # DEAL_TYPE_BALANCE
            "entry": 0,
            "symbol": "",
            "profit": 1000.0
        }
        self.assertFalse(is_trade_deal(balance_deal))
        self.assertIsNone(normalize_deal(balance_deal))

    def test_is_trade_deal_filters_entry_in(self):
        entry_in_deal = {
            "ticket": 1001,
            "type": 0,  # BUY
            "entry": 0,  # DEAL_ENTRY_IN (Position open, not closed exit)
            "symbol": "EURUSD"
        }
        self.assertFalse(is_trade_deal(entry_in_deal))
        self.assertIsNone(normalize_deal(entry_in_deal))

    def test_normalize_valid_buy_exit_deal(self):
        buy_exit_deal = {
            "ticket": 2001,
            "order": 6001,
            "position_id": 8001,
            "symbol": "XAUUSD",
            "type": 0,  # BUY exit (closing a SELL position)
            "entry": 1,  # DEAL_ENTRY_OUT
            "volume": 0.1,
            "price": 2350.50,
            "price_position_open": 2360.00,
            "time": 1723464000,  # 2024-08-12 12:00:00 UTC
            "profit": 95.0,
            "commission": -2.0,
            "swap": -0.5,
            "magic": 777,
            "comment": "SL hit"
        }

        res = normalize_deal(buy_exit_deal)
        self.assertIsNotNone(res)
        self.assertEqual(res["deal_id"], "2001")
        self.assertEqual(res["order_id"], "6001")
        self.assertEqual(res["position_id"], "8001")
        self.assertEqual(res["symbol"], "XAUUSD")
        self.assertEqual(res["side"], "SELL")  # BUY exit deal maps to position side SELL
        self.assertEqual(res["volume"], 0.1)
        self.assertEqual(res["close_price"], 2350.50)
        self.assertEqual(res["open_price"], 2360.00)
        self.assertEqual(res["profit"], 95.0)
        self.assertEqual(res["commission"], -2.0)
        self.assertEqual(res["swap"], -0.5)
        self.assertEqual(res["magic_number"], 777)
        self.assertEqual(res["comment"], "SL hit")
        self.assertTrue(res["close_time"].endswith("Z"))

    def test_normalize_valid_sell_exit_deal(self):
        sell_exit_deal = {
            "ticket": 2002,
            "order": 6002,
            "position_id": 8002,
            "symbol": "EURUSD",
            "type": 1,  # SELL exit (closing a BUY position)
            "entry": 1,  # DEAL_ENTRY_OUT
            "volume": 0.5,
            "price": 1.08500,
            "price_position_open": 1.08000,
            "time": 1723464000,
            "profit": 250.0,
            "commission": -3.5,
            "swap": 0.0,
            "magic": 0,
            "comment": ""
        }

        res = normalize_deal(sell_exit_deal)
        self.assertIsNotNone(res)
        self.assertEqual(res["deal_id"], "2002")
        self.assertEqual(res["side"], "BUY")  # SELL exit deal maps to position side BUY
        self.assertEqual(res["volume"], 0.5)
        self.assertEqual(res["profit"], 250.0)


if __name__ == "__main__":
    unittest.main()
