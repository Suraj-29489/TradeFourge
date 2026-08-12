"""
Security AST Scanner Test — Read-Only Guarantee.
Parses all Python source files in app/ using standard AST module.
Verifies ZERO occurrences of trade execution calls (order_send, order_check, position modifications).
"""

import ast
import unittest
from pathlib import Path

FORBIDDEN_FUNCTIONS = {
    "order_send",
    "order_check",
    "position_modify",
    "positions_modify",
    "order_calc_margin",
    "order_calc_profit",
    "buy",
    "sell"
}


class TestNoTradeExecution(unittest.TestCase):

    def test_no_trade_execution_code_in_app(self):
        app_dir = Path(__file__).parent.parent / "app"
        self.assertTrue(app_dir.exists(), f"App directory not found at {app_dir}")

        python_files = list(app_dir.rglob("*.py"))
        self.assertGreater(len(python_files), 0, "No Python source files found in app/")

        violations = []

        for py_file in python_files:
            content = py_file.read_text(encoding="utf-8")
            tree = ast.parse(content, filename=str(py_file))

            for node in ast.walk(tree):
                # Check function calls: e.g. mt5.order_send(...) or client.order_send(...)
                if isinstance(node, ast.Call):
                    func_name = None
                    if isinstance(node.func, ast.Name):
                        func_name = node.func.id
                    elif isinstance(node.func, ast.Attribute):
                        func_name = node.func.attr

                    if func_name and func_name.lower() in FORBIDDEN_FUNCTIONS:
                        violations.append(f"{py_file.name}:{node.lineno} calls forbidden function '{func_name}'")

                # Check function definitions: e.g. def order_send(...)
                elif isinstance(node, ast.FunctionDef):
                    if node.name.lower() in FORBIDDEN_FUNCTIONS:
                        violations.append(f"{py_file.name}:{node.lineno} defines forbidden method '{node.name}'")

        self.assertEqual(len(violations), 0, f"FORBIDDEN TRADE EXECUTION CODE DETECTED:\n" + "\n".join(violations))


if __name__ == "__main__":
    unittest.main()
