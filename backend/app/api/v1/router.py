from fastapi import APIRouter

from app.api.v1 import health
from app.modules.admin.router import router as admin_router
from app.modules.analysis.router import router as analysis_router
from app.modules.auth.router import router as auth_router
from app.modules.chat.router import router as chat_router
from app.modules.entities.router import router as entities_router
from app.modules.findings.router import router as findings_router
from app.modules.geo.router import router as geo_router
from app.modules.projects.router import router as projects_router
from app.modules.reports.router import router as reports_router
from app.modules.research.router import router as research_router
from app.modules.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth_router)
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
