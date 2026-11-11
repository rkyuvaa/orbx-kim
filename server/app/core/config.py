from functools import lru_cache
import warnings

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "CRMFinance - KIM API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    debug: bool = False

    database_url: str = "sqlite:///./dev.db"

    secret_key: str = "change-me-in-production-use-a-random-64-char-string"
    algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_hours: float = 10.0
    refresh_token_days: float = 10 / 24

    access_token_cookie_secure: bool = False
    refresh_token_cookie_name: str = "refresh_token"
    enable_ssl: bool = False

    cors_origins: str = "http://localhost:5173,http://localhost"

    seed_default_password: str = "Kim@2025"

    # OmniERP employee webhook authentication
    omnierp_employee_webhook_token: str | None = None

    # SMS Provider Settings (TextGuru / HTTP Gateway)
    sms_provider: str = "textguru"
    sms_api_url: str = "https://www.textguru.in/api/v22.0/"
    sms_api_method: str = "GET"
    sms_username: str | None = None
    sms_password: str | None = None
    sms_sender_id: str | None = None
    sms_entity_id: str | None = None
    sms_registration_template_id: str | None = None
    sms_otp_template_id: str | None = None
    sms_is_enabled: bool = True

    # Web Push Notification Settings (VAPID)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_claim_email: str = "mailto:admin@konwertindiamotors.com"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def validate_production_safety(self) -> None:
        """Warn on unsafe defaults when running in production."""
        if self.secret_key == "change-me-in-production-use-a-random-64-char-string":
            warnings.warn(
                "Using default secret_key. Set SECRET_KEY in .env for production.",
                RuntimeWarning,
            )
        if self.seed_default_password == "Kim@2025":
            warnings.warn(
                "Using default seed_default_password. Set SEED_DEFAULT_PASSWORD in .env for production.",
                RuntimeWarning,
            )
        if not self.access_token_cookie_secure and self.enable_ssl:
            warnings.warn(
                "access_token_cookie_secure should be True when enable_ssl is True for secure cookie handling.",
                RuntimeWarning,
            )


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.validate_production_safety()
    return s


settings = get_settings()
