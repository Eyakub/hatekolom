from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import json


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Hate Kolom"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    SECRET_KEY: str = "change-me"
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://hatekolom_user:hatekolom_pass@db:5432/hatekolom_db"
    DATABASE_URL_SYNC: str = "postgresql://hatekolom_user:hatekolom_pass@db:5432/hatekolom_db"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me-jwt"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Backblaze B2
    B2_ENDPOINT: str = ""
    B2_KEY_ID: str = ""
    B2_APP_KEY: str = ""
    B2_BUCKET_NAME: str = ""
    B2_REGION: str = "us-west-004"

    # Video Security
    VIDEO_SIGNING_SECRET: str = "change-me-video"

    # SMS
    SMS_API_KEY: str = "mock"
    SMS_SENDER_ID: str = "HateKolom"

    # CORS
    CORS_ORIGINS: str = '["http://localhost:3000"]'

    # Superadmin bootstrap
    SUPERADMIN_PHONE: str = "01700000000"
    SUPERADMIN_PASSWORD: str = "admin123"

    # SSLCommerz
    SSLCOMMERZ_STORE_ID: str = ""
    SSLCOMMERZ_STORE_PASSWORD: str = ""
    SSLCOMMERZ_SANDBOX: bool = True
    SSLCOMMERZ_SUCCESS_URL: str = "http://localhost:3001/payment/success"
    SSLCOMMERZ_FAIL_URL: str = "http://localhost:3001/payment/fail"
    SSLCOMMERZ_CANCEL_URL: str = "http://localhost:3001/payment/cancel"
    SSLCOMMERZ_IPN_URL: str = "http://localhost:8001/api/v1/payments/sslcommerz/ipn"

    # SMTP Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "Hate Kolom"
    SMTP_FROM_EMAIL: str = "noreply@example.com"

    # SMS
    SMS_API_URL: str = "https://bulksmsbd.net/api/smsapi"
    SMS_MOCK: bool = True

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=(".env", ".env.prod"), case_sensitive=True, extra="ignore")


settings = Settings()
