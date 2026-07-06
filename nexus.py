import os
from dotenv import load_dotenv

_ENV_PATH = ".env"

load_dotenv(_ENV_PATH)

def _key(name: str) -> str:
    return os.getenv(name, "")

def _call_ai(prompt: str) -> str:
    pass
