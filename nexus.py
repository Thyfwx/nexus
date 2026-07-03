import os
from dotenv import load_dotenv

_ENV_PATH = ".env"

def _key(name: str) -> str:
    load_dotenv(_ENV_PATH, override=True)
    return os.getenv(name, "")

def _call_ai(prompt: str) -> str:
    pass
