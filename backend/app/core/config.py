from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    PROJECT_NAME: str = "HisaabAI Retail Intelligence"
    VERSION: str = "0.3.0"
    DESCRIPTION: str = "Retail decision support for Pakistani general stores (CYE 2026, Track 3)"

    ENVIRONMENT: str = "development"

    # Database. A relative SQLite path is resolved against the backend folder, so the
    # app finds the same file no matter which directory it is started from.
    DATABASE_URL: str = f"sqlite:///{(BACKEND_DIR / 'hisaab_ai.db').as_posix()}"

    # Store profile (the demo store)
    DEFAULT_STORE_ID: int = 1
    STORE_NAME: str = "Al-Madina General Store"
    STORE_LOCATION: str = "G-9 Markaz, Islamabad"
    STORE_OWNER: str = "Haji Muhammad Akram"
    STORE_TIMEZONE: str = "Asia/Karachi"
    STORE_CURRENCY: str = "PKR"
    DEFAULT_CREDIT_TERM_DAYS: int = 30

    # Demo data
    DEMO_DATA_SEED: int = 42
    DEMO_DATA_LABEL: str = "Demo Data"
    DEMO_HISTORY_DAYS: int = 365
    # Re-seed on startup when the demo data is missing, from an older schema, or stale.
    DEMO_AUTO_REFRESH: bool = True
    DEMO_RESET_KEY: str = "cye2026"

    # CORS: comma-separated origins. "*" is fine for the local demo.
    CORS_ORIGINS: str = "*"

    # LLM providers (keys only from the environment or .env, never stored or returned)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    LLM_TIMEOUT_SECONDS: float = 20.0
    # "auto" tries Gemini, then Groq, then the offline engine. "offline" skips the LLMs.
    COPILOT_MODE: str = "auto"

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("DATABASE_URL")
    @classmethod
    def _resolve_sqlite_path(cls, value: str) -> str:
        prefix = "sqlite:///"
        if value.startswith(prefix) and not value.startswith(prefix + "/"):
            raw = value[len(prefix):]
            path = Path(raw)
            if raw != ":memory:" and not path.is_absolute():
                return prefix + (BACKEND_DIR / path).resolve().as_posix()
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
