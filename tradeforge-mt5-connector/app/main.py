"""
TradeForge MetaTrader 5 Companion CLI Entrypoint.
Provides commands: run, status, pair, sync, history, doctor.
Strictly Read-Only — Contains NO trade execution or order modification capabilities.
"""

import sys
import os
import argparse
import logging

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from app import __version__
from app.config import config
from app.logging_config import setup_logging
from app.sync.manager import SyncManager
from app.security.credentials import CredentialManager
from app.api.client import TradeForgeAPIClient
from app.storage.database import ConnectorDatabase
from app.mt5.client import MT5Client, MT5_AVAILABLE
from app.mt5.terminal_detector import TerminalDetector

setup_logging()
logger = logging.getLogger("tradeforge.cli")


def cmd_status(args):
    """Displays current connector status summary."""
    print("\n============================================================")
    print(f"TradeForge MT5 Connector v{__version__}")
    print("============================================================\n")

    manager = SyncManager()
    summary = manager.get_status_summary()

    print(f"Connector Status : {summary['state']}")
    print(f"Paired           : {'Yes' if summary['paired'] else 'No'}")
    print(f"Connector ID     : {summary['connector_id'] or 'Not paired'}")
    print(f"Backend API URL  : {summary['api_url']}")
    print(f"MT5 Terminal     : {summary['mt5_status']} ({summary['mt5_detail']})")
    print(f"Account Number   : {summary['account_number']}")
    print(f"MT5 Server       : {summary['server']}")
    print(f"Last Account Sync: {summary['last_account_sync'] or 'Never'}")
    print(f"Last History Sync: {summary['last_history_sync'] or 'Never'}")
    print(f"Total Synced     : {summary['total_synced_deals']} deals\n")


def cmd_pair(args):
    """Executes pairing flow with TradeForge account."""
    print("\n============================================================")
    print("TradeForge MT5 Connector — Pairing Setup")
    print("============================================================\n")

    email = args.email or input("Enter your TradeForge account email: ").strip()
    if not email:
        print("[FAIL] Email is required for pairing.")
        sys.exit(1)

    pairing_code = args.code
    connector_name = args.name or "Desktop MT5 Terminal"

    manager = SyncManager()
    ok, result = manager.pairing_service.pair_connector(
        user_email=email,
        pairing_code=pairing_code,
        connector_name=connector_name
    )

    if ok:
        print("\n[OK] Connector paired successfully!")
        print(f"Connector ID : {result}")
        print("API Key      : Securely saved in OS Credential Manager.")
        print("\nYou can now run 'python -m app.main run' to start background synchronization.\n")
    else:
        print(f"\n[FAIL] Pairing failed: {result}\n")
        sys.exit(1)


def cmd_sync(args):
    """Executes immediate manual account and history sync."""
    print("\nExecuting manual TradeForge MT5 sync cycle...")
    manager = SyncManager()
    if not manager.initialize():
        print("[FAIL] Sync failed: Connector is not paired or MT5 is unavailable.")
        sys.exit(1)
    
    manager.run_sync_cycle()
    print("[OK] Sync cycle finished successfully.\n")


def cmd_doctor(args):
    """Runs complete system diagnostic check."""
    print("\n============================================================")
    print("TradeForge MT5 Companion — Diagnostic Doctor")
    print("============================================================\n")

    checks_passed = 0
    checks_failed = 0

    def report(ok: bool, label: str, detail: str):
        nonlocal checks_passed, checks_failed
        if ok:
            print(f"  [PASS] {label}: {detail}")
            checks_passed += 1
        else:
            print(f"  [FAIL] {label}: {detail}")
            checks_failed += 1

    # 1. Python Version
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    report(sys.version_info >= (3, 10), "Python Version", f"v{py_ver} (>=3.10 required)")

    # 2. MetaTrader5 Package
    report(MT5_AVAILABLE, "MT5 Python Package", "Installed" if MT5_AVAILABLE else "Missing MetaTrader5 package")

    # 3. Credential Storage
    has_key = CredentialManager.has_api_key()
    report(has_key, "OS Keyring Storage", "API key found in OS Credential Manager" if has_key else "No API key stored (run 'python -m app.main pair')")

    # 4. SQLite Storage
    db = ConnectorDatabase()
    conf = db.get_config()
    report(conf is not None and conf.connector_id is not None, "Local SQLite Database", f"Connector ID: {conf.connector_id if conf else 'Uninitialized'}")

    # 5. MT5 Initialization & Account
    mt5_client = MT5Client()
    mt5_ok = mt5_client.initialize()
    report(mt5_ok, "MT5 Initialization", "Connected to MT5 terminal" if mt5_ok else "Could not initialize MT5 terminal")

    if mt5_ok:
        acc_info = mt5_client.get_account_info()
        report(
            acc_info is not None and acc_info.get("login", 0) > 0,
            "MT5 Account Login",
            f"Account {acc_info.get('login')} on {acc_info.get('server')}" if acc_info else "No account logged in"
        )
        mt5_client.shutdown()

    # 6. TradeForge API Connectivity
    api_client = TradeForgeAPIClient()
    try:
        res = api_client.request("GET", "/api/mt5/health", requires_auth=False, max_retries=1)
        report(True, "TradeForge Backend Reachable", f"API at {config.api_url} responded")
    except Exception as err:
        report(False, "TradeForge Backend Reachable", f"Could not reach {config.api_url}: {err}")

    # 7. History Sync & Reconciliation Cursors
    if conf and conf.connector_id:
        try:
            mt5_temp = MT5Client()
            if mt5_temp.initialize():
                info = mt5_temp.get_account_info()
                if info and info.get("login"):
                    st = db.get_sync_state(str(info["login"]))
                    if st:
                        report(
                            True,
                            "History Cursor & Reconciliation",
                            f"Last successful sync: {st.last_successful_sync or 'None'} | Synced deals: {st.total_synced_deals} | Status: {st.last_sync_status}"
                        )
                mt5_temp.shutdown()
        except Exception:
            pass


    print("\n============================================================")
    print(f"DIAGNOSTIC SUMMARY: {checks_passed} Passed, {checks_failed} Failed")
    print("============================================================\n")


def cmd_run(args):
    """Starts background sync daemon loop."""
    manager = SyncManager()
    manager.start_daemon()


def main():
    parser = argparse.ArgumentParser(
        prog="TradeForgeMT5Connector",
        description="TradeForge MetaTrader 5 Companion Read-Only Desktop Connector"
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("--gui", action="store_true", help="Launch desktop GUI window")

    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # gui
    subparsers.add_parser("gui", help="Launch desktop GUI status window")

    # run
    subparsers.add_parser("run", help="Start background synchronization daemon")

    # status
    subparsers.add_parser("status", help="Show current connector and MT5 status")

    # pair
    pair_parser = subparsers.add_parser("pair", help="Pair connector with TradeForge account")
    pair_parser.add_argument("--email", help="TradeForge account email")
    pair_parser.add_argument("--code", help="Optional pairing code")
    pair_parser.add_argument("--name", help="Custom connector name")

    # sync
    subparsers.add_parser("sync", help="Trigger immediate manual sync")

    # history
    subparsers.add_parser("history", help="Trigger immediate manual history sync")

    # doctor
    subparsers.add_parser("doctor", help="Run system diagnostic checks")

    args = parser.parse_args()

    if args.gui or args.command == "gui":
        from app.gui.launcher import launch_gui
        launch_gui()
    elif args.command == "run":
        cmd_run(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "pair":
        cmd_pair(args)
    elif args.command == "sync" or args.command == "history":
        cmd_sync(args)
    elif args.command == "doctor":
        cmd_doctor(args)
    else:
        # Default behavior for double-click in Windows Explorer: Launch Desktop GUI
        try:
            from app.gui.launcher import launch_gui
            launch_gui()
        except Exception as err:
            logger.warning(f"Could not launch GUI, falling back to CLI help: {err}")
            parser.print_help()


if __name__ == "__main__":
    main()
