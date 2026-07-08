from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # JWT
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 480

    # Trino
    TRINO_HOST: str = "trino.example.internal"
    TRINO_PORT: int = 8081
    TRINO_USER: str = "admin"
    TRINO_CATALOG: str = "iceberg"
    TRINO_SCHEMA_OPS: str = "silver_ops"
    TRINO_SCHEMA_BRONZE: str = "bronze_legacy"
    TRINO_SCHEMA_ZABBIX: str = "bronze_monitoring"
    TRINO_SCHEMA_GOLD_ZABBIX: str = "gold_monitoring"
    TRINO_SCHEMA_TICKETING: str = "bronze_ticketing"
    TRINO_SCHEMA_BILLING: str = "bronze_billing"

    # Nomes de tabelas TICKETING/Zabbix (configurável caso o ambiente mude)
    TICKETING_TABLE: str = "ticketing_ops"

    # SFTP
    SFTP_HOST: str = ""
    SFTP_PORT: int = 22
    SFTP_USER: str = ""
    SFTP_PASS: str = ""
    SFTP_REMOTE_PATH: str = "/upload"

    # TICKETING API
    HELPDESK_API_BASE: str = "https://helpdesk.example.com"
    HELPDESK_BEARER_TOKEN: str = ""

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
