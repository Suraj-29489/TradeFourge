"""
Central Synchronization Manager and Scheduler Loop.
Orchestrates heartbeat, account metadata sync, history sync, and reconciliation tasks.
Manages connector lifecycle state and handles automatic MT5/network reconnection.
"""

import time
import logging
import threading
from enum import Enum
from app.config import config
from app.storage.database import ConnectorDatabase
from app.security.credentials import CredentialManager
from app.mt5.client import MT5Client, BaseMT5Client
from app.mt5.terminal_detector import TerminalDetector, TerminalState
from app.mt5.account_reader import AccountReader
from app.mt5.history_reader import HistoryReader
from app.api.client import TradeForgeAPIClient
from app.api.pairing import PairingService
from app.api.heartbeat import HeartbeatService
from app.api.accounts import AccountSyncService
from app.api.trades import TradeBatchService
from app.mt5.position_reader import PositionReader
from app.api.live import LiveStateService
from app.sync.live_sync import LiveSyncWorker
from app.sync.account_sync import AccountSyncWorker
from app.sync.history_sync import HistorySyncWorker
from app.sync.reconciliation import ReconciliationWorker
from app.errors import AuthenticationError, NetworkError, MT5OfflineError, ConnectorError

logger = logging.getLogger("tradeforge.sync.manager")


class ConnectorState(str, Enum):
    UNPAIRED = "UNPAIRED"
    PAIRED = "PAIRED"
    MT5_OFFLINE = "MT5_OFFLINE"
    MT5_CONNECTED = "MT5_CONNECTED"
    SYNCING = "SYNCING"
    SYNCED = "SYNCED"
    BACKEND_OFFLINE = "BACKEND_OFFLINE"
    AUTH_ERROR = "AUTH_ERROR"
    ERROR = "ERROR"


class SyncManager:
    """Central daemon controller for TradeForge MT5 Connector operations."""

    def __init__(self, mt5_client: BaseMT5Client | None = None, db: ConnectorDatabase | None = None):
        self.db = db or ConnectorDatabase()
        self.mt5_client = mt5_client or MT5Client()
        self.detector = TerminalDetector(self.mt5_client)
        
        # Readers & Workers
        self.account_reader = AccountReader(self.mt5_client)
        self.history_reader = HistoryReader(self.mt5_client)
        self.position_reader = PositionReader(self.mt5_client)
        self.api_client = TradeForgeAPIClient()
        
        self.pairing_service = PairingService(self.api_client, self.db)
        self.heartbeat_service = HeartbeatService(self.api_client)
        self.account_api = AccountSyncService(self.api_client)
        self.trade_api = TradeBatchService(self.api_client)
        self.live_api = LiveStateService(self.api_client)
        
        self.account_worker = AccountSyncWorker(self.account_reader, self.account_api, self.db)
        self.history_worker = HistorySyncWorker(self.history_reader, self.trade_api, self.db)
        self.reconciliation_worker = ReconciliationWorker(self.history_worker)
        self.live_worker = LiveSyncWorker(self.account_reader, self.position_reader, self.live_api)

        # State tracking
        self.state = ConnectorState.UNPAIRED
        self._running = False
        self._threads: list[threading.Thread] = []


    def get_status_summary(self) -> dict:
        """Returns diagnostic summary of connector state for CLI/UI."""
        config_record = self.db.get_config()
        has_key = CredentialManager.has_api_key()
        
        term_state, term_detail = self.detector.detect_status()
        acc_info = self.account_reader.read_account() if term_state == TerminalState.CONNECTED else None
        
        account_num = acc_info["account_number"] if acc_info else "None"
        server = acc_info["server"] if acc_info else "None"
        
        sync_state = self.db.get_sync_state(account_num) if acc_info else None

        return {
            "version": config.connector_version,
            "state": self.state.value,
            "paired": bool(config_record and has_key),
            "connector_id": config_record.connector_id if config_record else None,
            "api_url": self.api_client.base_url,
            "mt5_status": term_state.value,
            "mt5_detail": term_detail,
            "account_number": account_num,
            "server": server,
            "last_account_sync": sync_state.last_account_sync if sync_state else None,
            "last_history_sync": sync_state.last_history_sync if sync_state else None,
            "total_synced_deals": sync_state.total_synced_deals if sync_state else 0
        }

    def initialize(self) -> bool:
        """Initializes database, credentials, and MT5 connection."""
        logger.info("[MANAGER] Starting TradeForge MT5 Connector v%s...", config.connector_version)

        # 1. Verify Pairing & Key
        conf = self.db.get_config()
        if not conf or not conf.connector_id or not CredentialManager.has_api_key():
            self.state = ConnectorState.UNPAIRED
            logger.warning("[MANAGER] Connector is UNPAIRED. Please run 'tradeforge-mt5 pair' first.")
            return False

        self.state = ConnectorState.PAIRED
        logger.info("[MANAGER] Pairing confirmed for Connector ID %s.", conf.connector_id)

        # 2. Attempt MT5 Connection
        mt5_ok = self.mt5_client.initialize()
        if not mt5_ok:
            self.state = ConnectorState.MT5_OFFLINE
            logger.warning("[MANAGER] MT5 terminal not connected currently. Will retry in background loop.")
        else:
            self.state = ConnectorState.MT5_CONNECTED

        return True

    def run_reconciliation(self):
        """Executes full 24h reconciliation check against MT5 database."""
        conf = self.db.get_config()
        if not conf or not conf.connector_id:
            return

        acc_payload = self.account_reader.read_account()
        if not acc_payload:
            return

        logger.info("[MANAGER] Running scheduled 24h reconciliation pass for account %s...", acc_payload["account_number"])
        try:
            self.reconciliation_worker.reconcile_account(
                connector_id=conf.connector_id,
                account_number=acc_payload["account_number"],
                server=acc_payload.get("server")
            )
        except Exception as err:
            logger.warning("[MANAGER] Reconciliation pass notice: %s", err)

    def run_live_sync(self):
        """Executes fast live position & floating P/L state synchronization pass."""
        conf = self.db.get_config()
        if not conf or not conf.connector_id:
            return

        if not self.mt5_client.is_connected():
            return

        try:
            self.live_worker.sync_live_state(conf.connector_id)
        except Exception as err:
            logger.debug("[MANAGER] Live sync tick notice: %s", err)

    def run_sync_cycle(self):
        """Executes one full sync pass: MT5 check -> Heartbeat -> Account Sync -> History Sync."""
        conf = self.db.get_config()
        if not conf or not conf.connector_id:
            logger.warning("[MANAGER] Cannot run sync cycle: Connector is not paired.")
            return

        connector_id = conf.connector_id

        # 1. MT5 Connectivity Check / Reinitialize
        if not self.mt5_client.is_connected():
            logger.info("[MANAGER] MT5 connection offline. Attempting initialization...")
            if not self.mt5_client.initialize():
                self.state = ConnectorState.MT5_OFFLINE
                logger.warning("[MANAGER] MT5 re-initialization failed. Will retry next cycle.")
                return

        self.state = ConnectorState.MT5_CONNECTED

        # 2. Discover Account
        acc_payload = self.account_reader.read_account()
        if not acc_payload:
            logger.warning("[MANAGER] MT5 is running but no account is logged in.")
            return

        account_number = acc_payload["account_number"]
        server = acc_payload["server"]

        # 3. Heartbeat Ping
        try:
            self.heartbeat_service.send_heartbeat(
                connector_id=connector_id,
                connected_accounts=[account_number]
            )
        except AuthenticationError:
            self.state = ConnectorState.AUTH_ERROR
            logger.error("[MANAGER] API authentication failed. Connector key revoked or invalid.")
            return
        except NetworkError:
            self.state = ConnectorState.BACKEND_OFFLINE
            logger.warning("[MANAGER] TradeForge backend unreachable during heartbeat.")
            return

        # 4. Account Metadata Sync
        try:
            self.account_worker.sync(connector_id)
        except Exception as err:
            logger.warning("[MANAGER] Account metadata sync notice: %s", err)

        # 5. History Trade Sync (Incremental)
        try:
            self.state = ConnectorState.SYNCING
            res = self.history_worker.sync_account_history(
                connector_id=connector_id,
                account_number=account_number,
                server=server
            )
            self.state = ConnectorState.SYNCED
            logger.info("[MANAGER] Sync cycle complete for account %s.", account_number)
        except Exception as err:
            self.state = ConnectorState.ERROR
            logger.error("[MANAGER] History sync error: %s", err)

    def start_daemon(self):
        """Starts background daemon scheduler loop with discrete timers."""
        if not self.initialize():
            logger.warning("[MANAGER] Initial checks failed. Starting scheduler loop in retry mode...")

        self._running = True
        logger.info("[MANAGER] TradeForge MT5 Connector daemon running. Press Ctrl+C to stop.\n")

        tick_step = 1.0  # 1-second resolution for live sync
        elapsed_sec = 0.0

        # Execute initial sync pass immediately
        self.run_sync_cycle()
        self.run_live_sync()

        while self._running:
            try:
                time.sleep(tick_step)
                elapsed_sec += tick_step
                current_tick = int(elapsed_sec)

                # Live Position Sync (every 2s default)
                if current_tick % int(config.live_sync_interval_sec) == 0:
                    self.run_live_sync()

                # History & Account Sync (every 60s default)
                if current_tick % config.account_sync_interval_sec == 0:
                    self.run_sync_cycle()

                # Periodic 24h Reconciliation (every 3600s default)
                if current_tick % config.reconciliation_interval_sec == 0:
                    self.run_reconciliation()

            except KeyboardInterrupt:
                logger.info("[MANAGER] Keyboard interrupt received. Stopping daemon...")
                break
            except Exception as err:
                logger.error("[MANAGER] Unexpected error in main loop: %s", err)

        self.stop()


    def stop(self):
        """Stops daemon loop and shuts down MT5 client."""
        self._running = False
        self.mt5_client.shutdown()
        logger.info("[MANAGER] TradeForge MT5 Connector stopped.")

