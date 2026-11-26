import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "HisaabAI Retail Intelligence"
    VERSION: str = "0.2.0-cye2026"
    DESCRIPTION: str = "Retail decision-support for Pakistani general stores (CYE 2026 Track 3)"
    
    # Environment
    ENVIRONMENT: str = "development"
    APP_DEBUG: bool = True
    
    @classmethod
    def parse_debug(cls, val):
        if isinstance(val, bool):
            return val
        if str(val).lower() in ("1", "true", "yes", "on", "debug"):
            return True
        return False
    
    # Database
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/hisaab_ai.db"
    
    # Store settings
    DEFAULT_STORE_ID: int = 1
    STORE_NAME: str = "Al-Madina General Store"
    STORE_CURRENCY: str = "PKR"
    DEFAULT_CREDIT_TERM_DAYS: int = 30
    
    # Demo and Seed
    DEMO_DATA_SEED: int = 42
    DEMO_DATA_LABEL: str = "Demo Data"
    
    # LLM Settings
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    DEFAULT_LLM_PROVIDER: str = "gemini"  # gemini, groq, or offline
    
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
