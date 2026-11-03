"""Define entidades ORM y restricciones de persistencia. Area: informes/veredicto.

ARCHIVO: backend/app/modules/reports/models.py

¿Qué es?
Las tablas del informe en la base de datos:
- reports: un informe completo del proyecto.
  Cada vez que se pide uno nuevo, sube su número de versión.
- report_sections: las partes del informe (resumen, mercado, riesgos, conclusiones...).

¿Para qué sirve?
Para guardar cada informe generado, de forma que se pueda consultar,
comparar entre versiones y exportar.

¿Quién lo usa?
generation.py (crea el contenido), runner.py (cambia el estado), service.py (lo muestra) y el
contexto del chat (context.py), que toma el último informe completado.

Reglas importantes que la base de datos hace cumplir:
- Cada proyecto tiene versiones únicas (no puede haber dos versiones 3).
- Un informe tiene una sola sección de cada tipo y una sola en cada posición.
- La versión siempre es mayor que cero.
"""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import AIProviderName
from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, str_enum
from app.modules.research.models import research_run_fk


class ReportStatus(StrEnum):
    """En qué va un informe."""

    GENERATING = "generating"  # Se está escribiendo.
    COMPLETED = "completed"  # Terminó bien.
    FAILED = "failed"  # Terminó con error.


class ReportSectionType(StrEnum):
    """Qué parte del informe es cada sección."""

    EXECUTIVE_SUMMARY = "executive_summary"  # Resumen y veredicto.
    IDEA_OVERVIEW = "idea_overview"  # La idea y sus atributos.
    MARKET = "market"  # Lo que se encontró sobre el mercado.
    COMPETITION = "competition"  # Competidores y alternativas.
    OPPORTUNITIES = "opportunities"  # Ventajas posibles.
    RISKS = "risks"  # Riesgos.
    HYPOTHESES = "hypotheses"  # Qué comprobar.
    MISSING_INFORMATION = "missing_information"  # Lo que falta saber.
    SOURCES = "sources"  # Fuentes consultadas.
    CONCLUSIONS = "conclusions"  # Conclusiones finales.


class Report(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Un informe completo del proyecto, con su versión y su estado."""

    __tablename__ = "reports"
    __table_args__ = (
        # Cada proyecto tiene versiones únicas: no puede haber dos informes con la misma versión.
        UniqueConstraint("project_id", "version"),
        # Si la investigación de origen se borra, el informe se conserva (run_id queda vacío).
        research_run_fk(ondelete="SET NULL (run_id)"),
        CheckConstraint("version > 0", name="version_positive"),
    )

    # A qué proyecto pertenece. Si se borra el proyecto, se borran sus informes.
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    # De qué investigación sale. Puede quedar vacío.
    run_id: Mapped[uuid.UUID | None]
    # Número de versión: 1, 2, 3... Cada informe nuevo sube el número.
    version: Mapped[int]
    # Título del informe, de hasta 200 letras.
    title: Mapped[str] = mapped_column(String(200))
    # Zonas geográficas que se consultaron para el informe. Por defecto, ninguna.
    geographic_scopes: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    # Estado del informe. Empieza en "generating".
    status: Mapped[ReportStatus] = mapped_column(
        str_enum(ReportStatus, "status", 15), server_default=ReportStatus.GENERATING.value
    )
    # Qué proveedor y modelo de IA lo generaron.
    ai_provider: Mapped[AIProviderName] = mapped_column(str_enum(AIProviderName, "ai_provider"))
    ai_model: Mapped[str] = mapped_column(String(100))
    # Código del error si falló. Vacío si salió bien.
    error_code: Mapped[str | None] = mapped_column(String(50))
    # Cuándo se completó. Vacío mientras no termine.
    completed_at: Mapped[datetime | None]


class ReportSection(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Una parte del informe: su tipo, su orden, su título y su contenido."""

    __tablename__ = "report_sections"
    __table_args__ = (
        # Dentro de un informe, cada posición aparece una sola vez.
        UniqueConstraint("report_id", "position"),
        # Dentro de un informe, cada tipo de sección aparece una sola vez.
        UniqueConstraint("report_id", "section_type"),
    )

    # A qué informe pertenece. Si se borra el informe, se borran sus secciones.
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"))
    # Qué tipo de sección es (resumen, mercado, riesgos...).
    section_type: Mapped[ReportSectionType] = mapped_column(
        str_enum(ReportSectionType, "section_type", 30)
    )
    # Orden en el que aparece en el informe.
    position: Mapped[int] = mapped_column(SmallInteger)
    # Título de la sección, de hasta 200 letras.
    title: Mapped[str] = mapped_column(String(200))
    # Markdown; el frontend lo renderiza sin permitir HTML crudo.
    content: Mapped[str]
    # El veredicto estructurado (solo en el resumen).
    # Es un objeto JSON; vacío en las demás secciones.
    verdict: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
