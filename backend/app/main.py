# ARCHIVO: backend/app/main.py
#
# ¿Qué es?
# El punto de entrada del backend. Aquí se arma la aplicación de FastAPI: se conectan la base de
# datos, la IA, los mapas, las reglas de seguridad y todas las rutas de la API.
#
# ¿Para qué sirve?
# Cuando ejecutas "uvicorn app.main:app", uvicorn busca la variable "app" de este archivo. Esa
# variable es la aplicación completa, lista para atender peticiones.
#
# ¿Quién lo usa?
# - uvicorn: lo arranca desde la terminal (comando de la guía del proyecto).
# - Las pruebas: llaman create_app() para armar una aplicación con datos de prueba.
#
# Partes principales:
# 1. create_app(): arma la aplicación. Recibe configuración y, opcionalmente, proveedores de IA y
#    de mapas (las pruebas usan proveedores falsos).
# 2. lifespan(): lo que pasa al arrancar y al apagar el servidor (abrir y cerrar conexiones,
#    revisar investigaciones que quedaron a medias).
# 3. Middlewares: reglas que se aplican a todas las respuestas (CORS y encabezados de seguridad).
# 4. Rutas base: "/" (estado del servicio) y "/perfil" (datos de la persona conectada).
#
# Cambios comunes:
# - Quién puede llamar a la API desde el navegador: CORS_ORIGINS en backend/.env.
# - Ver o no la documentación /docs: APP_ENV (development la muestra, production no).

"""Ensamblaje de FastAPI, middleware, proveedores y tareas de fondo."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from app.api.deps import CurrentUser
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.rate_limit import LoginRateLimiter
from app.core.supabase_auth import SupabaseTokenVerifier
from app.db.session import build_engine, build_sessionmaker
from app.modules.ai.factory import build_ai_provider
from app.modules.ai.providers.base import AIProvider
from app.modules.analysis.runner import AnalysisRunner
from app.modules.auth.router import router as legacy_auth_router
from app.modules.geo.providers.base import GeoProvider
from app.modules.geo.providers.factory import build_geo_provider
from app.modules.reports.runner import ReportRunner
from app.modules.research.orchestrator import ResearchOrchestrator, recover_interrupted_runs
from app.modules.users.router import legacy_password_router
from app.modules.users.schemas import UserRead

logger = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None,
    ai_provider: AIProvider | None = None,
    geo_provider: GeoProvider | None = None,
) -> FastAPI:
    """Arma la aplicación completa.

    - settings: configuración. Si no se da, se lee del .env.
    - ai_provider y geo_provider: proveedores ya creados (las pruebas los pasan para no llamar
      a servicios reales). Si no se dan, se crean según la configuración.
    """
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    # Se construye aquí para fallar al arrancar si AI_PROVIDER no es válido.
    provider = ai_provider or build_ai_provider(settings)
    geo = geo_provider or build_geo_provider(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        """Lo que pasa al arrancar (antes del "yield") y al apagar (después del "yield")."""
        # El engine no abre conexiones hasta la primera consulta.
        engine = build_engine(settings.database_url.get_secret_value())
        app.state.sessionmaker = build_sessionmaker(engine)
        # Cada servicio de fondo recibe lo que necesita para trabajar sin una petición del
        # navegador.
        app.state.research_orchestrator = ResearchOrchestrator(
            app.state.sessionmaker, provider, settings
        )
        app.state.analysis_runner = AnalysisRunner(app.state.sessionmaker, provider, settings)
        app.state.report_runner = ReportRunner(app.state.sessionmaker, provider, settings, geo)
        app.state.geo_provider = geo
        # Al arrancar, las investigaciones que quedaron "en curso" de una sesión anterior se marcan
        # como interrumpidas. Así no se quedan para siempre en espera.
        if settings.research_recover_on_startup:
            try:
                if recovered := await recover_interrupted_runs(app.state.sessionmaker):
                    logger.warning("%d investigaciones marcadas como interrumpidas", recovered)
            # Si la base de datos no responde al arrancar, el servidor sigue; solo se avisa.
            except (OSError, SQLAlchemyError):
                logger.warning("No se pudieron revisar las investigaciones interrumpidas")
        yield
        # Al apagar: cerramos conexiones a los proveedores y a la base de datos.
        await provider.aclose()
        await geo.aclose()
        await engine.dispose()

    # La documentación interactiva (/docs) solo aparece en desarrollo.
    docs_enabled = settings.is_development
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs" if docs_enabled else None,
        # ReDoc está desactivado: solo se usa /docs.
        redoc_url=None,
        openapi_url="/openapi.json" if docs_enabled else None,
        lifespan=lifespan,
    )
    # Guardamos en la aplicación las piezas que las dependencias necesitan (ver api/deps.py).
    app.state.settings = settings
    app.state.ai_provider = provider
    app.state.geo_provider = geo
    # El verificador de Supabase solo existe si SUPABASE_URL está configurada.
    app.state.supabase_jwt_verifier = (
        SupabaseTokenVerifier(settings) if settings.supabase_url is not None else None
    )
    app.state.login_limiter = LoginRateLimiter(
        settings.login_max_failed_attempts, settings.login_lockout_seconds
    )

    # Autenticación por header Bearer (sin cookies): allow_credentials=False.
    # CORS: solo los orígenes de CORS_ORIGINS pueden llamar a la API desde el navegador.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def add_security_headers(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Agrega encabezados de seguridad a cada respuesta.

        - nosniff: el navegador no adivina el tipo de contenido.
        - DENY: la página no se puede meter en un marco (iframe) de otro sitio.
        - Referrer-Policy: limita qué dirección de origen se envía a otros sitios.
        - no-store: el navegador no guarda copias de las respuestas.
        """
        response = await call_next(request)
        # "setdefault" solo agrega el encabezado si la ruta no lo puso ya.
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Cache-Control", "no-store")
        return response

    register_exception_handlers(app)

    @app.get("/", tags=["health"])
    async def root() -> dict[str, str]:
        """Devuelve el nombre del servicio y confirma que está activo."""
        return {"service": settings.app_name, "status": "ok"}

    @app.get("/perfil", response_model=UserRead, tags=["users"])
    async def read_profile(user: CurrentUser) -> UserRead:
        """Devuelve el perfil de la persona conectada."""
        return UserRead.model_validate(user)

    # Todas las rutas de la API se cuelgan bajo el prefijo (por ejemplo /api/v1).
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    # La autenticación antigua solo se monta si está activada en la configuración.
    if settings.legacy_auth_enabled:
        app.include_router(legacy_auth_router, prefix=settings.api_v1_prefix)
        app.include_router(legacy_password_router, prefix=settings.api_v1_prefix)
    return app


# La aplicación que uvicorn arranca (uvicorn app.main:app).
app = create_app()
