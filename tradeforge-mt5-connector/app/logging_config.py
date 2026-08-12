"""
Logging Configuration for TradeForge MT5 Connector.
Implements structured logging with strict secret-scrubbing.
"""

import logging
import re
import sys
from app.config import config


class SecretScrubbingFilter(logging.Filter):
    """
    Filter that automatically redacts API keys and sensitive tokens from log messages.
    Guarantees no raw API key (tf_mt5_...) or MT5 password appears in logs.
    """

    # Matches TradeForge API key format (tf_mt5_ followed by hex characters)
    API_KEY_REGEX = re.compile(r"tf_mt5_[a-fA-F0-9]{16,}")
    BEARER_REGEX = re.compile(r"Bearer\s+[^\s']+", re.IGNORECASE)

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self.API_KEY_REGEX.sub("tf_mt5_***[REDACTED]***", record.msg)
            record.msg = self.BEARER_REGEX.sub("Bearer ***[REDACTED]***", record.msg)
        
        if record.args:
            new_args = []
            for arg in record.args:
                if isinstance(arg, str):
                    arg = self.API_KEY_REGEX.sub("tf_mt5_***[REDACTED]***", arg)
                    arg = self.BEARER_REGEX.sub("Bearer ***[REDACTED]***", arg)
                new_args.append(arg)
            record.args = tuple(new_args)

        return True


def setup_logging():
    """Initializes global logging with stream handler and rotated file logging."""
    log_level = getattr(logging, config.log_level, logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    stream_handler.addFilter(SecretScrubbingFilter())

    handlers: list[logging.Handler] = [stream_handler]

    # Persistent log file under %LOCALAPPDATA%\TradeForge\logs\connector.log
    try:
        from logging.handlers import RotatingFileHandler
        log_dir = config.data_dir / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / "connector.log"

        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=5 * 1024 * 1024,  # 5 MB per file
            backupCount=3,  # Keep 3 rotated log backups
            encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        file_handler.addFilter(SecretScrubbingFilter())
        handlers.append(file_handler)
    except Exception as err:
        sys.stderr.write(f"Notice: Could not setup file logging: {err}\n")

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers = handlers

    # Suppress verbose third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


setup_logging()
logger = logging.getLogger("tradeforge")
