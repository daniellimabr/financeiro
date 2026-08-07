from datetime import date

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 dias

    google_client_id: str = ""
    google_client_secret: str = ""
    oauth_redirect_base_url: str = "http://localhost:8080"

    frontend_login_success_path: str = "/"
    frontend_login_path: str = "/login"

    cookie_secure: bool = False

    pluggy_client_id: str = ""
    pluggy_client_secret: str = ""
    pluggy_base_url: str = "https://api.pluggy.ai"
    pluggy_sync_cutoff_date: date = date(2026, 1, 1)


settings = Settings()
