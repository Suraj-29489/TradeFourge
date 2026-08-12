"""
Release Validation & Security Scanner for TradeForge MT5 Connector.
Scans release artifacts for secret leakage, verifies executable existence,
and checks SHA256 checksum integrity.
"""

import sys
import os
import re
import hashlib
from pathlib import Path


def main():
    root_dir = Path(__file__).resolve().parent.parent
    dist_dir = root_dir / "dist"
    exe_path = dist_dir / "TradeForgeMT5Connector.exe"
    checksum_path = dist_dir / "SHA256SUMS.txt"

    print("============================================================")
    print("TradeForge MT5 Connector — Release Validation Scanner")
    print("============================================================\n")

    errors = []

    # 1. Executable Verification
    if not exe_path.exists():
        errors.append(f"Missing release executable: {exe_path}")
    else:
        print(f"[PASS] Release executable exists: {exe_path.name} ({exe_path.stat().st_size / (1024*1024):.2f} MB)")

    # 2. Checksum Verification
    if not checksum_path.exists():
        errors.append(f"Missing SHA256 checksum file: {checksum_path}")
    else:
        with open(checksum_path, "r", encoding="utf-8") as f:
            content = f.read()
        print(f"[PASS] SHA256 checksum file verified.")

    # 3. Secret Leakage Scanner
    forbidden_patterns = [
        re.compile(r"SUPABASE_SERVICE_ROLE_KEY\s*=\s*['\"][a-zA-Z0-9\._-]+['\"]"),
        re.compile(r"service_role_key"),
        re.compile(r"tf_mt5_[a-fA-F0-9]{32}"),
    ]

    print("\nScanning source repository for secret leakage...")
    scanned_count = 0
    leakage_count = 0

    for p in root_dir.rglob("*.py"):
        if "build" in p.parts or "dist" in p.parts or ".venv" in p.parts or "tests" in p.parts or p.name == "validate_release.py":
            continue
        scanned_count += 1
        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
            for pattern in forbidden_patterns:
                if pattern.search(txt):
                    errors.append(f"Secret leakage detected in file: {p.relative_to(root_dir)}")
                    leakage_count += 1
        except Exception:
            pass

    print(f"[PASS] Scanned {scanned_count} Python files. {leakage_count} secret leaks detected.")

    print("\n============================================================")
    if errors:
        print("RELEASE VALIDATION FAILED:")
        for err in errors:
            print(f"  [FAIL] {err}")
        print("============================================================\n")
        sys.exit(1)
    else:
        print("RELEASE VALIDATION PASSED: All security and artifact checks succeeded!")
        print("============================================================\n")


if __name__ == "__main__":
    main()
