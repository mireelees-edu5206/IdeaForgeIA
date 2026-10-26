from functools import lru_cache
from typing import Annotated, Any, Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.core.enums import AIProviderName


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "IdeaForge AI"
    app_version: str = "0.1.0"
    app_env: Literal["development", "test", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    api_v1_prefix: str = "/api/v1"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    # SecretStr evita que la URL (con contraseña) aparezca en logs o repr.
    database_url: SecretStr
    # Solo para tests de integración; el nombre de la BD debe terminar en "_test".
    test_database_url: SecretStr | None = None

    # Autenticación
    secret_key: SecretStr | None = None
    legacy_auth_enabled: bool = False
    access_token_expire_minutes: int = Field(default=30, ge=5, le=120)
    refresh_token_expire_days: int = Field(default=7, ge=1, le=30)
    login_max_failed_attempts: int = Field(default=5, ge=1)
    login_lockout_seconds: int = Field(default=900, ge=60)
    supabase_url: str | None = None
    supabase_publishable_key: SecretStr | None = None
    supabase_service_role_key: SecretStr | None = None
    supabase_jwt_secret: SecretStr | None = None
    supabase_jwks_url: str | None = None

    # Las credenciales solo se leen en backend; SecretStr evita mostrarlas en repr o logs.
    ai_provider: AIProviderName = AIProviderName.FAKE
    ai_fallback_provider: AIProviderName | None = None
    gemini_api_key: SecretStr | None = None
    gemini_model: str = Field(default="gemini-3.5-flash-lite", min_length=1, max_length=100)
    gemini_search_grounding_enabled: bool = True
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = Field(default="llama3.2:3b", min_length=1, max_length=100)
    ollama_think: bool = False
    ai_timeout_seconds: float = Field(default=360, ge=5, le=600)
    ai_max_concurrency: int = Field(default=3, ge=1, le=10)
    # Latencia simulada del proveedor falso, para ver el progreso en desarrollo.
    ai_fake_latency_ms: int = Field(default=700, ge=0, le=10_000)

    # Geodatos: consultas manuales a servicios públicos de OpenStreetMap.
    geo_provider: Literal["openstreetmap"] = "openstreetmap"
    geo_nominatim_url: str = "https://nominatim.openstreetmap.org"
    geo_overpass_url: str = "https://overpass-api.de/api/interpreter"
    geo_user_agent: str = Field(
        default="IdeaForgeAI/0.1 (OpenStreetMap geocoding client)",
        min_length=8,
        max_length=200,
    )

    # Investigación
    research_max_questions: int = Field(default=8, ge=3, le=15)
    research_max_runs_per_day: int = Field(default=10, ge=1)
    # Al arrancar, marca como interrumpidas las ejecuciones que quedaron a medias.
    research_recover_on_startup: bool = True

    @field_validator("secret_key", mode="before")
    @classmethod
    def empty_secret_key_is_missing(cls, value: Any) -> Any:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_url", mode="before")
    @classmethod
    def empty_supabase_url_is_missing(cls, value: Any) -> Any:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_url")
    @classmethod
    def validate_supabase_url(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip().rstrip("/")
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or parsed.path not in {"", "/"}
        ):
            raise ValueError("SUPABASE_URL debe ser un origen HTTPS válido.")
        return value

    @field_validator("supabase_publishable_key", mode="before")
    @classmethod
    def empty_supabase_publishable_key_is_missing(cls, value: Any) -> Any:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_service_role_key", mode="before")
    @classmethod
    def empty_supabase_service_key_is_missing(cls, value: Any) -> Any:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_jwt_secret", mode="before")
    @classmethod
    def empty_supabase_secret_is_missing(cls, value: Any) -> Any:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_jwks_url", mode="before")
    @classmethod
    def empty_supabase_jwks_url_is_missing(cls, value: Any) -> Any:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_jwks_url")
    @classmethod
    def validate_supabase_jwks_url(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("SUPABASE_JWKS_URL debe ser una URL HTTPS válida.")
        return value

    @field_validator("gemini_api_key", mode="before")
    @classmethod
    def empty_gemini_key_is_missing(cls, value: Any) -> Any:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("ollama_base_url")
    @classmethod
    def validate_ollama_base_url(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        parsed = urlsplit(value)
        try:
            if parsed.port is not None and not 1 <= parsed.port <= 65535:
                raise ValueError
        except ValueError:
            raise ValueError("OLLAMA_BASE_URL contiene un puerto inválido.") from None
        invalid_url = (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
        )
        if invalid_url:
            raise ValueError("OLLAMA_BASE_URL debe ser una URL HTTP(S) sin credenciales.")
        if parsed.query or parsed.fragment or parsed.path not in {"", "/"}:
            raise ValueError("OLLAMA_BASE_URL solo debe contener el origen del servidor Ollama.")
        return value

    @field_validator("geo_nominatim_url", "geo_overpass_url")
    @classmethod
    def validate_geo_service_url(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(
                "La URL del proveedor geográfico debe ser HTTPS y no incluir credenciales."
            )
        return value

    @field_validator("geo_user_agent")
    @classmethod
    def validate_geo_user_agent(cls, value: str) -> str:
        value = value.strip()
        if "\r" in value or "\n" in value:
            raise ValueError("GEO_USER_AGENT no puede contener saltos de línea.")
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("cors_origins")
    @classmethod
    def forbid_wildcard_origin(cls, value: list[str]) -> list[str]:
        if "*" in value:
            raise ValueError("CORS_ORIGINS no puede contener '*'; indica orígenes explícitos.")
        return value

    @model_validator(mode="after")
    def validate_ai_provider_setup(self) -> "Settings":
        if self.legacy_auth_enabled and (
            self.secret_key is None or len(self.secret_key.get_secret_value()) < 32
        ):
            raise ValueError("SECRET_KEY debe tener al menos 32 caracteres con auth heredada.")
        if self.app_env == "production" and self.ai_provider == AIProviderName.FAKE:
            raise ValueError("AI_PROVIDER=fake solo se permite en desarrollo y tests.")
        if self.ai_provider == AIProviderName.LEGACY:
            raise ValueError(
                "AI_PROVIDER=legacy solo identifica registros históricos; no es seleccionable."
            )
        if self.ai_fallback_provider in {AIProviderName.FAKE, AIProviderName.LEGACY}:
            raise ValueError("AI_FALLBACK_PROVIDER solo puede ser gemini u ollama.")
        if self.ai_fallback_provider == self.ai_provider:
            raise ValueError("AI_FALLBACK_PROVIDER debe ser distinto de AI_PROVIDER.")
        gemini_selected = AIProviderName.GEMINI in {
            self.ai_provider,
            self.ai_fallback_provider,
        }
        if gemini_selected and not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY es obligatoria cuando Gemini está seleccionado.")
        return self

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
