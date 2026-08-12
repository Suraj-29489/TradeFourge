# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller Spec File for TradeForge MT5 Connector.
Bundles Python MT5 Connector runtime, MetaTrader5 package, keyring, and Tkinter GUI.
Produces standalone TradeForgeMT5Connector.exe executable.
"""

import sys
import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect required submodules & data
hidden_imports = [
    'app',
    'app.main',
    'app.config',
    'app.logging_config',
    'app.gui.launcher',
    'app.api.client',
    'app.api.pairing',
    'app.api.heartbeat',
    'app.api.accounts',
    'app.api.trades',
    'app.api.live',
    'app.mt5.client',
    'app.mt5.account_reader',
    'app.mt5.history_reader',
    'app.mt5.deal_normalizer',
    'app.mt5.position_reader',
    'app.mt5.terminal_detector',
    'app.sync.manager',
    'app.sync.account_sync',
    'app.sync.history_sync',
    'app.sync.live_sync',
    'app.sync.reconciliation_sync',
    'app.storage.database',
    'app.storage.schema',
    'app.security.credentials',
    'MetaTrader5',
    'httpx',
    'keyring',
    'sqlite3',
    'tkinter',
    'tkinter.ttk',
]

datas = []

a = Analysis(
    ['app/main.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'scipy',
        'pandas',
        'numpy',
        'PIL',
        'IPython',
        'notebook',
        'unittest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='TradeForgeMT5Connector',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Launch as GUI application on Windows
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
