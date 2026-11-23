"""Une los routers de todos los dominios bajo una sola API. Area: aplicacion.

ARCHIVO: backend/app/api/v1/router.py

¿Qué es?
El router raíz de la versión 1. Incluye, en orden, los routers de salud, usuarios, proyectos,
investigación, hallazgos, entidades, análisis, chat, informes, geografía y administración.
También define `GET /perfil`, que devuelve los datos de la persona conectada.

¿Para qué sirve?
Para que `main.py` monte toda la API con una sola línea (`app.include_router(api_router, ...)`).

¿Quién lo usa?
`app/main.py`, que le agrega el prefijo `/api/v1`.

Importante: el orden de los `include_router` no cambia las rutas, pero sí el orden en `/docs`.
"""

from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.api.v1 import health
from app.modules.admin.router import router as admin_router
from app.modules.analysis.router import router as analysis_router
from app.modules.chat.router import router as chat_router
from app.modules.entities.router import router as entities_router
from app.modules.findings.router import router as findings_router
from app.modules.geo.router import router as geo_router
from app.modules.projects.router import router as projects_router
from app.modules.reports.router import router as reports_router
from app.modules.research.router import router as research_router
from app.modules.users.router import router as users_router
from app.modules.users.schemas import UserRead

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(users_router)
api_router.include_router(projects_router)
api_router.include_router(research_router)
api_router.include_router(findings_router)
api_router.include_router(entities_router)
api_router.include_router(analysis_router)
api_router.include_router(chat_router)
api_router.include_router(reports_router)
api_router.include_router(geo_router)
api_router.include_router(admin_router)


@api_router.get("/perfil", response_model=UserRead, tags=["users"])
async def read_profile(user: CurrentUser) -> UserRead:
    """Devuelve el perfil de la persona conectada."""
    return UserRead.model_validate(user)
