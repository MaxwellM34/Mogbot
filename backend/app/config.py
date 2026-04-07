import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve env file from project root based on ENV variable.
# ENV=local  -> .env.local  (default)
# ENV=cloud  -> .env.cloud
_project_root = Path(__file__).resolve().parents[2]
_env_name = os.getenv("ENV", "local").strip().lower()
_env_file = _project_root / f".env.{_env_name}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_env_file), env_file_encoding="utf-8")

    anthropic_api_key: str = ""
    database_url: str = "postgresql://mogbot:mogbot@localhost:5432/mogbot"
    host: str = "0.0.0.0"
    port: int = 8000
    workspace_dir: str = "./workspace"
    default_model: str = "claude-sonnet-4-20250514"
    usd_to_cad_rate: float = 1.36


settings = Settings()
