"""
TradeFourge v4.0.1 — MT5 Bridge Settings & Environment Configuration
"""

import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "TradeFourge MT5 Bridge"
    VERSION: str = "4.0.1"
    PORT: int = int(os.getenv("PORT", "8000"))
    ENV: str = os.getenv("ENV", "production")
    
    # Security Secrets
    BRIDGE_SECRET_KEY: str = os.getenv("BRIDGE_SECRET_KEY", "tf_bridge_secret_key_super_secure_v4_0_1_2026")
    BRIDGE_ENCRYPTION_KEY: str = os.getenv("BRIDGE_ENCRYPTION_KEY", "gZ7Z90uE1f_wKq23kL80w1M3N5P7R9S1T3V5X7Z90uE=")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Cloud Integration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # Local Storage
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./bridge_storage.db")
    
    # Sync Configuration
    DEFAULT_SYNC_INTERVAL_SECONDS: int = 300 # 5 minutes
    MAX_RETRY_ATTEMPTS: int = 5

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
