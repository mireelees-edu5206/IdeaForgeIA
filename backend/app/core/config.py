# ARCHIVO: backend/app/core/config.py
#
# ¿Qué es?
# La "hoja de configuración" del backend. Lee las variables del archivo backend/.env (o del entorno)
# y las revisa: si falta una obligatoria o tiene un formato incorrecto, el servidor no arranca.
#
# ¿Para qué sirve?
# Para cambiar el comportamiento del backend sin tocar el código: qué base de datos usar, qué IA
# usar, cuántas preguntas por investigación, cuánto dura el bloqueo de login, etc.
#
# ¿Quién lo usa?
# Casi todo el backend. main.py lo carga al arrancar; deps.py, los servicios y las pruebas leen
# sus valores. El frontend no lo usa directamente.
#
# Cómo se cambia un valor:
# 1. Escribe el nombre de la variable en MAYÚSCULAS en backend/.env, por ejemplo LOG_LEVEL=DEBUG.
# 2. Reinicia el backend. Los cambios no se aplican en caliente.
# 3. Si el valor no cumple una regla (por ejemplo, un número fuera de rango), el arranque falla
#    con un mensaje que dice cuál variable está mal.
#
# Tipos de campos que verás:
# - "str": texto. "int" y "float": números. "bool": verdadero o falso (true/false).
# - "SecretStr": secreto. Se guarda oculto para que no aparezca en logs ni en mensajes de error.
# - "X | None = None": opcional. Si no se configura, vale None (vacío).
# - "Literal[...]": solo acepta esos valores exactos.
# - "Field(default=..., ge=..., le=...)": valor por defecto y límites mínimo (ge) y máximo (le).

"""Lee y valida la configuracion del backend."""

from functools import lru_cache
from typing import Annotated, Any, Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.core.enums import AIProviderName


class Settings(BaseSettings):
    """Todas las variables de configuración del backend, con sus valores por defecto y sus
    reglas."""

    # env_file=".env" indica que lee backend/.env. extra="ignore" ignora variables desconocidas.
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ----- Aplicación -----
    # Nombre que aparece en la documentación de la API y en la respuesta de la raíz.
    app_name: str = "IdeaForge AI"
    app_version: str = "0.1.0"
    # En "development" se muestra /docs (documentación interactiva); en "production" no.
    app_env: Literal["development", "test", "production"] = "development"
    # Nivel de detalle de los logs: DEBUG (mucho) a ERROR (solo fallos graves).
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    # Prefijo de todas las rutas de la API. Con "/api/v1", cada ruta empieza con esa parte.
    api_v1_prefix: str = "/api/v1"
    # Orígenes (direcciones del frontend) que pueden llamar a la API. NoDecode permite escribirlos
    # separados por comas en el .env; la regla split_cors_origins los separa.
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    # ----- Base de datos -----
    # Dirección de PostgreSQL. SecretStr evita que la URL (con contraseña) aparezca en logs o repr.
    database_url: SecretStr
    # Solo para tests de integración. El nombre de la base debe terminar en "_test" (las pruebas la
    # vacían).
    test_database_url: SecretStr | None = None

    # ----- Autenticación -----
    # Clave para la autenticación heredada (JWT propio). Debe tener al menos 32 caracteres si se
    # usa.
    secret_key: SecretStr | None = None
    # Si es True, también se aceptan tokens de la autenticación antigua. Solo para la migración.
    legacy_auth_enabled: bool = False
    # Cuánto dura un token de acceso (entre 5 y 120 minutos).
    access_token_expire_minutes: int = Field(default=30, ge=5, le=120)
    # Cuántos días dura un token de renovación (entre 1 y 30 días).
    refresh_token_expire_days: int = Field(default=7, ge=1, le=30)
    # Cuántos intentos fallidos de login se permiten antes de bloquear.
    login_max_failed_attempts: int = Field(default=5, ge=1)
    # Cuánto dura el bloqueo, en segundos (mínimo 60).
    login_lockout_seconds: int = Field(default=900, ge=60)
    # Datos de Supabase. Son opcionales: si faltan, la autenticación de Supabase no funciona.
    supabase_url: str | None = None
    supabase_publishable_key: SecretStr | None = None
    supabase_service_role_key: SecretStr | None = None
    supabase_jwt_secret: SecretStr | None = None
    supabase_jwks_url: str | None = None

    # ----- Inteligencia artificial (Motor propio de IdeaForge) -----
    # Proveedor principal: "engine" (motor propio en Python) o "fake" (de prueba).
    ai_provider: AIProviderName = AIProviderName.FAKE
    # Proveedor de respaldo opcional.
    ai_fallback_provider: AIProviderName | None = None
    # Identificador de versión del motor propio de razonamiento, predicción y navegación web.
    ai_engine_model: str = Field(default="ideaforge-engine-v1", min_length=1, max_length=100)
    # Tiempo máximo de espera de una llamada a la IA, en segundos (entre 5 y 600).
    ai_timeout_seconds: float = Field(default=360, ge=5, le=600)
    # Cuántas llamadas a la IA pueden correr al mismo tiempo (entre 1 y 10).
    ai_max_concurrency: int = Field(default=3, ge=1, le=10)
    # Latencia simulada del proveedor falso, para ver el progreso en desarrollo (en milisegundos).
    ai_fake_latency_ms: int = Field(default=700, ge=0, le=10_000)

    # ----- Geodatos (OpenStreetMap) -----
    # Por ahora solo existe OpenStreetMap como proveedor de mapas.
    geo_provider: Literal["openstreetmap"] = "openstreetmap"
    # Servicio para convertir un nombre de lugar en coordenadas (geocodificación).
    geo_nominatim_url: str = "https://nominatim.openstreetmap.org"
    # Servicio para buscar negocios cerca de un punto.
    geo_overpass_url: str = "https://overpass-api.de/api/interpreter"
    # Identificación que se envía a OpenStreetMap. Es obligatoria por las reglas de uso del
    # servicio.
    geo_user_agent: str = Field(
        default="IdeaForgeAI/0.1 (OpenStreetMap geocoding client)",
        min_length=8,
        max_length=200,
    )

    # ----- Investigación -----
    # Cuántas preguntas genera la IA por investigación (entre 3 y 15).
    research_max_questions: int = Field(default=8, ge=3, le=15)
    # Cuántas investigaciones puede iniciar una cuenta por día. Al pasar el límite, responde 429.
    research_max_runs_per_day: int = Field(default=10, ge=1)
    # Al arrancar, marca como interrumpidas las investigaciones que quedaron a medias.
    research_recover_on_startup: bool = True

    @field_validator("secret_key", mode="before")
    @classmethod
    def empty_secret_key_is_missing(cls, value: Any) -> Any:
        """Trata una clave vacía como si no existiera."""
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_url", mode="before")
    @classmethod
    def empty_supabase_url_is_missing(cls, value: Any) -> Any:
        """Trata una URL de Supabase vacía como si no existiera."""
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_url")
    @classmethod
    def validate_supabase_url(cls, value: str | None) -> str | None:
        """Revisa que la URL de Supabase sea HTTPS y solo tenga el origen (sin rutas ni
        contraseña)."""
        if value is None:
            return value
        value = value.strip().rstrip("/")
        parsed = urlsplit(value)
        # Se rechaza si no es https, no tiene dominio, trae credenciales, parámetros o una ruta.
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
        """Trata la clave publicable vacía como si no existiera."""
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_service_role_key", mode="before")
    @classmethod
    def empty_supabase_service_key_is_missing(cls, value: Any) -> Any:
        """Trata la clave de servicio vacía como si no existiera."""
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_jwt_secret", mode="before")
    @classmethod
    def empty_supabase_secret_is_missing(cls, value: Any) -> Any:
        """Trata el secreto JWT vacío como si no existiera."""
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_jwks_url", mode="before")
    @classmethod
    def empty_supabase_jwks_url_is_missing(cls, value: Any) -> Any:
        """Trata la URL de claves públicas vacía como si no existiera."""
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_jwks_url")
    @classmethod
    def validate_supabase_jwks_url(cls, value: str | None) -> str | None:
        """Revisa que la URL de claves públicas sea HTTPS y sin credenciales."""
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

    @field_validator("geo_nominatim_url", "geo_overpass_url")
    @classmethod
    def validate_geo_service_url(cls, value: str) -> str:
        """Revisa que las direcciones de OpenStreetMap sean HTTPS y sin credenciales."""
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
        """Revisa que la identificación de OpenStreetMap no tenga saltos de línea."""
        value = value.strip()
        # Un salto de línea dentro de un encabezado HTTP podría romper la petición.
        if "\r" in value or "\n" in value:
            raise ValueError("GEO_USER_AGENT no puede contener saltos de línea.")
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: Any) -> Any:
        """Convierte "http://a.com, http://b.com" en una lista, quitando espacios y barras
        finales."""
        if isinstance(value, str):
            return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("cors_origins")
    @classmethod
    def forbid_wildcard_origin(cls, value: list[str]) -> list[str]:
        """Impide el comodín "*", que dejaría entrar a cualquier sitio. Hay que listar los
        orígenes."""
        if "*" in value:
            raise ValueError("CORS_ORIGINS no puede contener '*'; indica orígenes explícitos.")
        return value

    @model_validator(mode="after")
    def validate_ai_provider_setup(self) -> "Settings":
        """Revisa que la combinación de proveedores de IA tenga sentido (se ejecuta al final)."""
        # Con la autenticación heredada, la clave secreta debe ser suficientemente larga.
        if self.legacy_auth_enabled and (
            self.secret_key is None or len(self.secret_key.get_secret_value()) < 32
        ):
            raise ValueError("SECRET_KEY debe tener al menos 32 caracteres con auth heredada.")
        # El proveedor de prueba nunca debe correr en producción.
        if self.app_env == "production" and self.ai_provider == AIProviderName.FAKE:
            raise ValueError("AI_PROVIDER=fake solo se permite en desarrollo y tests.")
        # "legacy" solo marca registros antiguos; no puede ser un proveedor activo.
        if self.ai_provider == AIProviderName.LEGACY:
            raise ValueError(
                "AI_PROVIDER=legacy solo identifica registros históricos; no es seleccionable."
            )
        # El respaldo solo puede ser el motor propio "engine", y debe ser distinto del principal.
        if self.ai_fallback_provider in {AIProviderName.FAKE, AIProviderName.LEGACY}:
            raise ValueError("AI_FALLBACK_PROVIDER solo puede ser engine.")
        if self.ai_fallback_provider == self.ai_provider:
            raise ValueError("AI_FALLBACK_PROVIDER debe ser distinto de AI_PROVIDER.")
        return self

    @property
    def is_development(self) -> bool:
        """Indica si el backend está en modo desarrollo (muestra /docs)."""
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    """Lee la configuración una sola vez y la reutiliza en todo el backend.

    lru_cache guarda el resultado: la primera llamada lee el .env,
    las siguientes devuelven lo mismo.
    """
    return Settings()
