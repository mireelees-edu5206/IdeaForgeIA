import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.rate_limit import LoginRateLimiter
from app.db.session import build_engine, build_sessionmaker
from app.modules.ai.factory import build_ai_provider
from app.modules.ai.providers.base import AIProvider
from app.modules.analysis.runner import AnalysisRunner
from app.modules.geo.providers.base import GeoProvider
from app.modules.geo.providers.factory import build_geo_provider
from app.modules.reports.runner import ReportRunner
from app.modules.research.orchestrator import ResearchOrchestrator, recover_interrupted_runs

logger = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None,
    ai_provider: AIProvider | None = None,
    geo_provider: GeoProvider | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    # Se construye aquí para fallar al arrancar si AI_PROVIDER no es válido.
    provider = ai_provider or build_ai_provider(settings)
    geo = geo_provider or build_geo_provider(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # El engine no abre conexiones hasta la primera consulta.
        engine = build_engine(settings.database_url.get_secret_value())
        app.state.sessionmaker = build_sessionmaker(engine)
        app.state.research_orchestrator = ResearchOrchestrator(
            app.state.sessionmaker, provider, settings
        )
        app.state.analysis_runner = AnalysisRunner(app.state.sessionmaker, provider, settings)
        app.state.report_runner = ReportRunner(app.state.sessionmaker, provider, settings)
        app.state.geo_provider = geo
        if settings.research_recover_on_startup:
            try:
                if recovered := await recover_interrupted_runs(app.state.sessionmaker):
                    logger.warning("%d investigaciones marcadas como interrumpidas", recovered)
            except (OSError, SQLAlchemyError):
                logger.warning("No se pudieron revisar las investigaciones interrumpidas")
        yield
        await provider.aclose()
        await geo.aclose()
        await engine.dispose()

    docs_enabled = settings.is_development
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs" if docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs_enabled else None,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.ai_provider = provider
    app.state.geo_provider = geo
    app.state.login_limiter = LoginRateLimiter(
        settings.login_max_failed_attempts, settings.login_lockout_seconds
    )

    # Autenticación por header Bearer (sin cookies): allow_credentials=False.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
