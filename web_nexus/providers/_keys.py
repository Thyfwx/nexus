"""Shared API-key reader. Pulls from .env or live env, sanitizes whitespace."""
import os
from dotenv import load_dotenv

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ENV_PATH = os.path.join(_BASE_DIR, ".env")


def get_key(name: str) -> str:
    if os.path.exists(_ENV_PATH):
        load_dotenv(_ENV_PATH, override=False)
    val = os.getenv(name) or ""
    return val.strip().strip('"').strip("'")
