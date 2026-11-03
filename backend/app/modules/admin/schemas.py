"""Valida contratos de entrada/salida. Area: administracion.

ARCHIVO: backend/app/modules/admin/schemas.py

¿Qué es?
Las "fichas" del panel de administración:
- ProviderMetrics: el uso de cada proveedor de IA (llamadas, éxitos, errores, tokens y costo).
- AdminAILogRead: una línea de la bitácora de llamadas a la IA.
- AdminOverview: el resumen general que ve la administradora.
- AdminUserRead: una cuenta, con cuántos proyectos e investigaciones tiene.
- AdminUserUpdate: lo que se puede cambiar de una cuenta (rol y si está activa).

¿Para qué sirve?
Para mostrar métricas y administrar cuentas, sin exponer nada sensible como contraseñas o claves.

¿Quién lo usa?
router.py y service.py de este módulo.

Campos opcionales: los que tienen "| None" pueden venir vacíos (null).
"""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.core.enums import AIProviderName
from app.core.schemas import PatchModel
from app.modules.ai.models import AICallStatus, AIOperation
from app.modules.projects.models import ProjectStatus
from app.modules.users.models import UserRole


class ProviderMetrics(BaseModel):
    """Cuánto se ha usado un proveedor de IA y cuánto ha costado."""

    provider: AIProviderName  # Qué proveedor es (Gemini, Ollama, etc.).
    total_calls: int  # Llamadas en total.
    success_calls: int  # Llamadas que salieron bien.
    error_calls: int  # Llamadas que fallaron.
    # Tiempo promedio de respuesta en milisegundos; vacío si no hay datos.
    avg_latency_ms: int | None
    input_tokens: int  # Tokens enviados a la IA (lo que se le mandó).
    output_tokens: int  # Tokens recibidos de la IA (lo que respondió).
    search_queries: int  # Búsquedas web que hizo el proveedor.
    estimated_cost_usd: Decimal  # Costo estimado en dólares.


class AdminAILogRead(BaseModel):
    """Una línea de la bitácora de IA: quién, qué, cuándo y cómo terminó.

    No guarda los textos enviados ni las claves: solo métricas y códigos de error.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # Identificador del registro.
    user_email: str | None = None  # Correo de quien lo pidió; vacío si la cuenta ya no existe.
    project_title: str | None = None  # Título del proyecto; vacío si ya no existe.
    provider: AIProviderName  # Proveedor que atendió la llamada.
    model: str  # Modelo que se usó.
    operation: AIOperation  # Para qué se usó (investigación, chat, informe, etc.).
    prompt_version: str | None  # Versión de las instrucciones usadas; vacía si no aplica.
    status: AICallStatus  # Éxito o error.
    error_code: str | None  # Código del error si falló.
    input_tokens: int | None  # Tokens enviados; vacío si el proveedor no lo informó.
    output_tokens: int | None  # Tokens recibidos; vacío si el proveedor no lo informó.
    search_queries_count: int  # Cuántas búsquedas web hizo.
    latency_ms: int | None  # Cuánto tardó, en milisegundos.
    estimated_cost_usd: Decimal | None  # Costo estimado; vacío si no se pudo calcular.
    created_at: datetime  # Cuándo ocurrió.


class AdminOverview(BaseModel):
    """El resumen general que ve la administradora en su pantalla principal."""

    total_users: int  # Cuentas en total.
    active_users: int  # Cuentas activas.
    admin_users: int  # Cuentas con rol de administrador.
    total_projects: int  # Proyectos en total.
    projects_by_status: dict[ProjectStatus, int]  # Cuántos proyectos hay en cada etapa.
    total_research_runs: int  # Investigaciones en total.
    completed_research_runs: int  # Investigaciones terminadas bien.
    failed_research_runs: int  # Investigaciones que fallaron.
    total_findings: int  # Hallazgos en total.
    total_reports: int  # Informes en total.
    total_ai_calls: int  # Llamadas a la IA en total.
    ai_by_provider: list[ProviderMetrics]  # El uso desglosado por proveedor.
    recent_ai_logs: list[AdminAILogRead]  # Las 25 llamadas más recientes.


class AdminUserRead(BaseModel):
    """Una cuenta tal como la ve la administradora."""

    id: uuid.UUID  # Identificador de la cuenta.
    email: str  # Correo.
    full_name: str  # Nombre.
    role: UserRole  # Rol: persona o administradora.
    is_active: bool  # Si la cuenta puede entrar.
    project_count: int  # Cuántos proyectos tiene.
    research_run_count: int  # Cuántas investigaciones ha hecho.
    last_login_at: datetime | None  # Última vez que entró; vacío si nunca.
    created_at: datetime  # Cuándo se creó.


class AdminUserUpdate(PatchModel):
    """Lo que la administradora puede cambiar de una cuenta. Todos los campos son opcionales."""

    role: UserRole | None = None  # Nuevo rol.
    is_active: bool | None = None  # Activar o desactivar la cuenta.
