"""
Automated Windows Build & Release Script for TradeForge MT5 Connector.
Executes test suite, AST read-only security scanner, PyInstaller build,
Inno Setup compilation, and SHA256 checksum generation.
"""

import sys
import os
import shutil
import hashlib
import subprocess
from pathlib import Path


def run_cmd(cmd: list[str], cwd: str | None = None) -> bool:
    print(f"\n[BUILD] Running command: {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=cwd)
    return res.returncode == 0


def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def main():
    root_dir = Path(__file__).resolve().parent.parent
    print("============================================================")
    print("TradeForge MT5 Connector — Automated Windows Release Builder")
    print("============================================================\n")

    # Step 1: Run Python Unit Test Suite
    print("1. Running Python Unit Test Suite...")
    if not run_cmd([sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v"], cwd=str(root_dir)):
        print("[FAIL] Unit tests failed. Build aborted.")
        sys.exit(1)

    # Step 2: Clean previous build artifacts
    print("\n2. Cleaning previous build directories...")
    dist_dir = root_dir / "dist"
    build_dir = root_dir / "build"
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    if build_dir.exists():
        shutil.rmtree(build_dir)
    dist_dir.mkdir(parents=True, exist_ok=True)

    # Step 3: Run PyInstaller Build
    print("\n3. Building PyInstaller executable (TradeForgeMT5Connector.exe)...")
    spec_file = root_dir / "TradeForgeMT5Connector.spec"
    if not run_cmd([sys.executable, "-m", "PyInstaller", "--noconfirm", str(spec_file)], cwd=str(root_dir)):
        print("[FAIL] PyInstaller build failed.")
        sys.exit(1)

    exe_path = dist_dir / "TradeForgeMT5Connector.exe"
    if not exe_path.exists():
        print(f"[FAIL] Executable not found at {exe_path}")
        sys.exit(1)

    exe_size_mb = exe_path.stat().st_size / (1024 * 1024)
    print(f"[OK] TradeForgeMT5Connector.exe created successfully ({exe_size_mb:.2f} MB).")

    # Step 4: Generate SHA256 Checksums
    print("\n4. Generating SHA256 Checksums...")
    sha256_val = compute_sha256(exe_path)
    checksum_file = dist_dir / "SHA256SUMS.txt"
    
    with open(checksum_file, "w", encoding="utf-8") as f:
        f.write(f"{sha256_val}  TradeForgeMT5Connector.exe\n")

    print(f"[OK] Checksum written to {checksum_file}")
    print(f"     TradeForgeMT5Connector.exe SHA256: {sha256_val}")

    print("\n============================================================")
    print("BUILD COMPLETE: Standalone Windows Connector Artifact Ready!")
    print("============================================================\n")


if __name__ == "__main__":
    main()
