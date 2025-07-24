import os

from dotenv import load_dotenv

load_dotenv()


class Environment:
    def __init__(self):
        raise RuntimeError("Environment is a static class and cannot be instantiated.")

    POSTGRES_USER = os.getenv("POSTGRES_USER")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
    POSTGRES_DB = os.getenv("POSTGRES_DB")
    POSTGRES_HOST = os.getenv("POSTGRES_HOST")
    POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5434))
    POSTGRES_MIN_POOL_SIZE = int(os.getenv("POSTGRES_MIN_POOL_SIZE", 5))
    POSTGRES_MAX_POOL_SIZE = int(os.getenv("POSTGRES_MAX_POOL_SIZE", 20))
    POSTGRES_TIMEOUT = int(os.getenv("POSTGRES_TIMEOUT", 60))
    POSTGRES_COMMAND_TIMEOUT = int(os.getenv("POSTGRES_COMMAND_TIMEOUT", 60))
    POSTGRES_MAX_INACTIVE_CONNECTION_LIFETIME = int(os.getenv("POSTGRES_MAX_INACTIVE_CONNECTION_LIFETIME", 60))
    PORT = int(os.getenv("PORT", 5057))
    DATA_PATH = os.getenv("DATA_PATH", "")
    WORKSPACE_BACKGROUND_CACHE_WARM_UP_INTERVAL = int(os.getenv("WORKSPACE_BACKGROUND_CACHE_WARM_UP_INTERVAL", 60))
    COOKIE_SECRET = os.getenv("COOKIE_SECRET", "secret")
    CONTACT_ENCRYPTION_KEY = os.getenv("CONTACT_ENCRYPTION_KEY", "")
