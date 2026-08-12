"""
TradeForge MetaTrader 5 Companion Desktop GUI Launcher.
Tkinter-based status window providing connection monitoring, pairing controls,
diagnostic execution, and background synchronization daemon management.
"""

import sys
import os
import threading
import webbrowser
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional

from app import __version__
from app.config import config
from app.sync.manager import SyncManager
from app.security.credentials import CredentialManager
from app.storage.database import ConnectorDatabase
from app.mt5.client import MT5Client, MT5_AVAILABLE
from app.api.client import TradeForgeAPIClient


class TradeForgeLauncherGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title(f"TradeForge MT5 Connector v{__version__}")
        self.root.geometry("540x620")
        self.root.resizable(False, False)
        self.root.configure(bg="#0F141C")

        self.manager = SyncManager()
        self.db = ConnectorDatabase()
        self.daemon_thread: Optional[threading.Thread] = None

        # Setup custom dark theme styling
        self._setup_styles()

        # Build UI layout
        self._create_header()
        self._create_status_cards()
        self._create_live_metrics_preview()
        self._create_pairing_section()
        self._create_action_buttons()
        self._create_footer()

        # Start periodic status refresh (every 3 seconds)
        self.refresh_status()

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")
        
        style.configure("TFrame", background="#0F141C")
        style.configure("Card.TFrame", background="#18202C", relief="flat")
        style.configure("TLabel", background="#0F141C", foreground="#E2E8F0", font=("Segoe UI", 9))
        style.configure("CardLabel.TLabel", background="#18202C", foreground="#94A3B8", font=("Segoe UI", 8, "bold"))
        style.configure("CardVal.TLabel", background="#18202C", foreground="#FFFFFF", font=("Segoe UI", 11, "bold"))
        
        style.configure("Header.TLabel", background="#0F141C", foreground="#FFFFFF", font=("Segoe UI", 14, "bold"))
        style.configure("SubHeader.TLabel", background="#0F141C", foreground="#3B82F6", font=("Segoe UI", 9, "bold"))

        style.configure("Primary.TButton", font=("Segoe UI", 9, "bold"), background="#2563EB", foreground="#FFFFFF")
        style.map("Primary.TButton", background=[("active", "#1D4ED8")])

        style.configure("Secondary.TButton", font=("Segoe UI", 9), background="#334155", foreground="#FFFFFF")
        style.map("Secondary.TButton", background=[("active", "#475569")])

    def _create_header(self):
        header_frame = ttk.Frame(self.root, padding=(20, 15, 20, 10))
        header_frame.pack(fill="x")

        title_lbl = ttk.Label(header_frame, text="TRADEFORGE MT5 CONNECTOR", style="Header.TLabel")
        title_lbl.pack(anchor="w")

        sub_lbl = ttk.Label(header_frame, text=f"v{__version__} • Secure Read-Only Synchronization Bridge", style="SubHeader.TLabel")
        sub_lbl.pack(anchor="w", pady=(2, 0))

    def _create_status_cards(self):
        cards_frame = ttk.Frame(self.root, padding=(20, 5))
        cards_frame.pack(fill="x")

        # Row 1: MT5 Status & TradeForge Status
        grid_frame = ttk.Frame(cards_frame)
        grid_frame.pack(fill="x", expand=True)

        # MT5 Card
        self.mt5_card = ttk.Frame(grid_frame, style="Card.TFrame", padding=12)
        self.mt5_card.grid(row=0, column=0, sticky="ew", padx=(0, 6), pady=4)
        grid_frame.columnconfigure(0, weight=1)

        ttk.Label(self.mt5_card, text="MT5 TERMINAL", style="CardLabel.TLabel").pack(anchor="w")
        self.mt5_status_val = ttk.Label(self.mt5_card, text="Checking...", style="CardVal.TLabel")
        self.mt5_status_val.pack(anchor="w", pady=(2, 0))
        self.mt5_detail_lbl = ttk.Label(self.mt5_card, text="--", style="CardLabel.TLabel")
        self.mt5_detail_lbl.pack(anchor="w")

        # TradeForge Card
        self.tf_card = ttk.Frame(grid_frame, style="Card.TFrame", padding=12)
        self.tf_card.grid(row=0, column=1, sticky="ew", padx=(6, 0), pady=4)
        grid_frame.columnconfigure(1, weight=1)

        ttk.Label(self.tf_card, text="TRADEFORGE CLOUD", style="CardLabel.TLabel").pack(anchor="w")
        self.tf_status_val = ttk.Label(self.tf_card, text="Checking...", style="CardVal.TLabel")
        self.tf_status_val.pack(anchor="w", pady=(2, 0))
        self.tf_detail_lbl = ttk.Label(self.tf_card, text="--", style="CardLabel.TLabel")
        self.tf_detail_lbl.pack(anchor="w")

    def _create_live_metrics_preview(self):
        metrics_frame = ttk.Frame(self.root, padding=(20, 10))
        metrics_frame.pack(fill="x")

        container = ttk.Frame(metrics_frame, style="Card.TFrame", padding=15)
        container.pack(fill="x")

        ttk.Label(container, text="LIVE TERMINAL PREVIEW", style="CardLabel.TLabel").pack(anchor="w", pady=(0, 8))

        row_frame = ttk.Frame(container, style="Card.TFrame")
        row_frame.pack(fill="x")

        # Balance
        col1 = ttk.Frame(row_frame, style="Card.TFrame")
        col1.pack(side="left", expand=True, fill="x")
        ttk.Label(col1, text="Balance", style="CardLabel.TLabel").pack(anchor="w")
        self.balance_val = ttk.Label(col1, text="$0.00", style="CardVal.TLabel")
        self.balance_val.pack(anchor="w")

        # Equity
        col2 = ttk.Frame(row_frame, style="Card.TFrame")
        col2.pack(side="left", expand=True, fill="x")
        ttk.Label(col2, text="Equity", style="CardLabel.TLabel").pack(anchor="w")
        self.equity_val = ttk.Label(col2, text="$0.00", style="CardVal.TLabel")
        self.equity_val.pack(anchor="w")

        # Floating P/L
        col3 = ttk.Frame(row_frame, style="Card.TFrame")
        col3.pack(side="left", expand=True, fill="x")
        ttk.Label(col3, text="Floating P/L", style="CardLabel.TLabel").pack(anchor="w")
        self.floating_val = ttk.Label(col3, text="$0.00", style="CardVal.TLabel")
        self.floating_val.pack(anchor="w")

    def _create_pairing_section(self):
        pair_frame = ttk.Frame(self.root, padding=(20, 10))
        pair_frame.pack(fill="x")

        self.pair_container = ttk.Frame(pair_frame, style="Card.TFrame", padding=15)
        self.pair_container.pack(fill="x")

        ttk.Label(self.pair_container, text="CONNECTOR PAIRING SETUP", style="CardLabel.TLabel").pack(anchor="w", pady=(0, 6))

        inputs_frame = ttk.Frame(self.pair_container, style="Card.TFrame")
        inputs_frame.pack(fill="x")

        # Email
        lbl_email = ttk.Label(inputs_frame, text="TradeForge Email:", style="CardLabel.TLabel")
        lbl_email.grid(row=0, column=0, sticky="w", padx=(0, 8), pady=4)
        self.entry_email = ttk.Entry(inputs_frame, width=28)
        self.entry_email.grid(row=0, column=1, sticky="ew", pady=4)

        # Code
        lbl_code = ttk.Label(inputs_frame, text="Pairing Code:", style="CardLabel.TLabel")
        lbl_code.grid(row=1, column=0, sticky="w", padx=(0, 8), pady=4)
        self.entry_code = ttk.Entry(inputs_frame, width=28)
        self.entry_code.grid(row=1, column=1, sticky="ew", pady=4)

        inputs_frame.columnconfigure(1, weight=1)

        self.btn_pair = ttk.Button(self.pair_container, text="Pair Connector with TradeForge", style="Primary.TButton", command=self.on_pair_click)
        self.btn_pair.pack(anchor="e", pady=(10, 0))

    def _create_action_buttons(self):
        btn_frame = ttk.Frame(self.root, padding=(20, 10))
        btn_frame.pack(fill="x")

        self.btn_sync = ttk.Button(btn_frame, text="Sync History Now", style="Secondary.TButton", command=self.on_sync_click)
        self.btn_sync.pack(side="left", padx=(0, 6))

        self.btn_doctor = ttk.Button(btn_frame, text="Run Diagnostics", style="Secondary.TButton", command=self.on_doctor_click)
        self.btn_doctor.pack(side="left", padx=6)

        self.btn_web = ttk.Button(btn_frame, text="Open TradeForge Web", style="Primary.TButton", command=self.on_web_click)
        self.btn_web.pack(side="right")

    def _create_footer(self):
        footer_frame = ttk.Frame(self.root, padding=(20, 10))
        footer_frame.pack(side="bottom", fill="x")

        self.footer_status = ttk.Label(footer_frame, text="Status: Initializing...", style="CardLabel.TLabel")
        self.footer_status.pack(anchor="w")

    def refresh_status(self):
        """Periodically queries status summary and updates GUI cards."""
        try:
            summary = self.manager.get_status_summary()
            
            # MT5 Status
            if summary["mt5_status"] == "Connected":
                self.mt5_status_val.configure(text="Connected", foreground="#10B981")
                self.mt5_detail_lbl.configure(text=f"Account #{summary['account_number']} ({summary['server']})")
            else:
                self.mt5_status_val.configure(text="Offline", foreground="#EF4444")
                self.mt5_detail_lbl.configure(text="MetaTrader 5 terminal not detected")

            # TradeForge Status
            if summary["paired"]:
                self.tf_status_val.configure(text="Paired & Connected", foreground="#10B981")
                self.tf_detail_lbl.configure(text=f"ID: {summary['connector_id'][:12]}...")
                self.pair_container.pack_forget()
            else:
                self.tf_status_val.configure(text="Not Paired", foreground="#F59E0B")
                self.tf_detail_lbl.configure(text="Enter pairing code below")
                self.pair_container.pack(fill="x")

            # Live Metrics
            mt5_client = MT5Client()
            if mt5_client.initialize():
                acc = mt5_client.get_account_info()
                poss = mt5_client.get_open_positions()
                mt5_client.shutdown()

                if acc:
                    b = acc.get("balance", 0.0)
                    eq = acc.get("equity", 0.0)
                    fl = acc.get("profit", 0.0)
                    cur = acc.get("currency", "USD")
                    sym = "USC" if cur == "USC" else "$"

                    self.balance_val.configure(text=f"{sym}{b:.2f}")
                    self.equity_val.configure(text=f"{sym}{eq:.2f}")
                    self.floating_val.configure(
                        text=f"{'+' if fl >= 0 else ''}{sym}{fl:.2f}",
                        foreground="#10B981" if fl >= 0 else "#EF4444"
                    )

            # Footer
            self.footer_status.configure(
                text=f"Last Sync: {summary['last_account_sync'] or 'Never'} | Synced Deals: {summary['total_synced_deals']}"
            )

        except Exception as err:
            self.footer_status.configure(text=f"Notice: {err}")

        # Schedule next refresh in 3 seconds
        self.root.after(3000, self.refresh_status)

    def on_pair_click(self):
        email = self.entry_email.get().strip()
        code = self.entry_code.get().strip()

        if not email:
            messagebox.showwarning("Input Required", "Please enter your TradeForge account email.")
            return

        ok, result = self.manager.pairing_service.pair_connector(
            user_email=email,
            pairing_code=code if code else None,
            connector_name="Desktop Windows Connector"
        )

        if ok:
            messagebox.showinfo("Success", f"Connector paired successfully!\nConnector ID: {result}")
            self.refresh_status()
        else:
            messagebox.showerror("Pairing Failed", f"Could not pair connector:\n{result}")

    def on_sync_click(self):
        def _run_sync():
            if not self.manager.initialize():
                messagebox.showerror("Sync Failed", "Connector is not paired or MT5 terminal is unavailable.")
                return
            self.manager.run_sync_cycle()
            messagebox.showinfo("Sync Complete", "Manual history sync cycle completed successfully.")
            self.refresh_status()

        threading.Thread(target=_run_sync, daemon=True).start()

    def on_doctor_click(self):
        import io

        old_stdout = sys.stdout
        sys.stdout = buffer = io.StringIO()
        
        from app.main import cmd_doctor
        cmd_doctor(None)
        
        sys.stdout = old_stdout
        diag_output = buffer.getvalue()

        diag_win = tk.Toplevel(self.root)
        diag_win.title("TradeForge Diagnostics Doctor")
        diag_win.geometry("520x400")
        diag_win.configure(bg="#0F141C")

        txt = tk.Text(diag_win, bg="#18202C", fg="#E2E8F0", font=("Consolas", 9), padding=10)
        txt.pack(fill="both", expand=True)
        txt.insert("1.0", diag_output)
        txt.configure(state="disabled")

    def on_web_click(self):
        url = config.api_url or "https://tradefourge.com"
        webbrowser.open(url)


def launch_gui():
    root = tk.Tk()
    app = TradeForgeLauncherGUI(root)
    root.mainloop()


if __name__ == "__main__":
    launch_gui()
