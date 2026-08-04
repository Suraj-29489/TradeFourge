"""
TradeFourge v4.0.1 — MT5 Investor Password Encryption Engine
Uses Fernet (AES-128-CBC + HMAC) for encrypting passwords stored locally inside the Bridge database.
"""

import base64
import hashlib
from cryptography.fernet import Fernet
from bridge.config import settings

def _get_fernet() -> Fernet:
    # Ensure key is valid 32-byte url-safe base64 string
    raw_key = settings.BRIDGE_ENCRYPTION_KEY.encode('utf-8')
    key = base64.urlsafe_b64encode(hashlib.sha256(raw_key).digest())
    return Fernet(key)

def encrypt_secret(plain_text: str) -> str:
    if not plain_text:
        return ""
    fernet = _get_fernet()
    encrypted_bytes = fernet.encrypt(plain_text.encode('utf-8'))
    return encrypted_bytes.decode('utf-8')

def decrypt_secret(cipher_text: str) -> str:
    if not cipher_text:
        return ""
    try:
        fernet = _get_fernet()
        decrypted_bytes = fernet.decrypt(cipher_text.encode('utf-8'))
        return decrypted_bytes.decode('utf-8')
    except Exception:
        return cipher_text
