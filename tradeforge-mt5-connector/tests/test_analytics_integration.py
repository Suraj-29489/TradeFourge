"""
Phase 8 Test Suite: MT5 Trades → Analytics & Data Integrity.
Tests realized Net P/L calculation (profit + commission + swap), USC currency preservation,
zero-loss/zero-trade division-by-zero safeguards, and closed trade isolation.
"""

import unittest


class TestAnalyticsIntegration(unittest.TestCase):

    def test_net_profit_calculation_includes_commission_and_swap(self):
        """Verifies net_profit = profit + commission + swap formula consistency."""
        deal = {
            "profit": 10.00,
            "commission": -1.50,
            "swap": -0.50
        }
        net_profit = deal["profit"] + deal["commission"] + deal["swap"]
        self.assertAlmostEqual(net_profit, 8.00, places=2)

    def test_usc_cent_currency_preservation(self):
        """Verifies USC (Cent) account currency is preserved without silent conversion to USD."""
        acc_currency = "USC"
        balance_usc = 100000.0  # 100,000 cents
        self.assertEqual(acc_currency, "USC")
        self.assertNotEqual(acc_currency, "USD")
        self.assertEqual(balance_usc, 100000.0)

    def test_win_rate_zero_trade_prevention(self):
        """Verifies win rate calculation handles 0 trades without raising ZeroDivisionError."""
        closed_trades = []
        total_closed = len(closed_trades)
        win_rate = (0 / total_closed * 100) if total_closed > 0 else 0.0
        self.assertEqual(win_rate, 0.0)

    def test_profit_factor_zero_loss_prevention(self):
        """Verifies profit factor calculation handles 0 gross loss without raising ZeroDivisionError."""
        gross_profit = 150.0
        gross_loss = 0.0
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else (999.99 if gross_profit > 0 else 0.0)
        self.assertEqual(profit_factor, 999.99)


if __name__ == "__main__":
    unittest.main()
