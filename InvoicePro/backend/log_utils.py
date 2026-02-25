# backend/log_utils.py

import sys
from loguru import logger
from backend.config import Config


def setup_logger():
    """Configure loguru logger based on settings in Config."""

    # Remove default logger
    logger.remove()

    # Console handler — colored, readable
    logger.add(
        sys.stdout,
        level=Config.LOG_LEVEL,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
               "<level>{level: <8}</level> | "
               "<cyan>{name}</cyan>:<cyan>{line}</cyan> — "
               "<level>{message}</level>",
        colorize=True,
    )

    # File handler — full logs saved to logs/
    logger.add(
        "logs/invoicepro.log",
        level="DEBUG",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{line} — {message}",
        rotation="10 MB",     # New file after 10MB
        retention="10 days",  # Keep logs for 10 days
        compression="zip",    # Compress old logs
    )

    logger.info(f"Logger initialized | Provider: {Config.MODEL_PROVIDER} | Level: {Config.LOG_LEVEL}")
    return logger


# Single shared logger instance — import this everywhere
app_logger = setup_logger()