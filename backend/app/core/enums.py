"""Enumeraciones de dominio compartidas entre módulos.

ARCHIVO: backend/app/core/enums.py

¿Qué es?
Es la lista oficial de opciones válidas del sistema: procedencia, estado de revisión, niveles,
prioridades, categorías de investigación, tipos de dato de la idea y proveedores de IA.

¿Para qué sirve?
Evita escribir textos sueltos ("ai", "proposed") en muchos archivos. Si una opción no está aquí,
el sistema no la acepta. Así los datos siempre tienen valores conocidos.

¿Quién lo usa?
Casi todos los módulos: modelos de la base de datos, esquemas de entrada y salida, servicios,
la configuración (config.py) y las pruebas.

Importante: los valores (los textos de la derecha del "=") se guardan en la base de datos. Si
cambias uno, los datos que ya existen con el texto anterior dejan de coincidir. Hay que crear
una migración de Alembic para ese cambio. Las etiquetas en español vienen del frontend.
"""

from enum import StrEnum


class Origin(StrEnum):
    """Quién creó un dato: la IA o la persona."""

    AI = "ai"
    USER = "user"


class ReviewStatus(StrEnum):
    """En qué estado de revisión está un dato propuesto por la IA."""

    PROPOSED = "proposed"  # Propuesto y todavía sin revisar.
    ACCEPTED = "accepted"  # La persona lo aceptó.
    REJECTED = "rejected"  # La persona lo descartó.


class Level(StrEnum):
    """Nivel de algo: confianza, potencial, riesgo, probabilidad o impacto."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    UNDETERMINED = "undetermined"  # No hay suficiente información para decidir.


class Priority(StrEnum):
    """Qué tan urgente o importante es una tarea o pregunta."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ResearchCategory(StrEnum):
    """Tema de un resultado de la investigación."""

    MARKET = "market"
    CUSTOMERS = "customers"
    COMPETITION = "competition"
    SUBSTITUTES = "substitutes"
    TECHNOLOGY = "technology"
    REGULATION = "regulation"
    PRICING = "pricing"
    OTHER = "other"


class AttributeType(StrEnum):
    """Partes de la idea que el usuario puede describir (problema, solución, etc.)."""

    PROBLEM = "problem"
    SOLUTION = "solution"
    CUSTOMER_SEGMENT = "customer_segment"
    PRODUCT_SERVICE = "product_service"
    CHANNELS = "channels"
    REVENUE_MODEL = "revenue_model"
    GEOGRAPHIC_SCOPE = "geographic_scope"
    DIFFERENTIATORS = "differentiators"
    TECHNOLOGIES = "technologies"


class AIProviderName(StrEnum):
    """Motores de IA que el sistema conoce.

    "engine" es el motor propio de IdeaForge en Python (razonamiento, predicción y búsqueda web).
    "fake" es el proveedor de pruebas (no se permite en producción). "legacy" solo marca
    registros históricos antiguos y nunca se puede elegir como proveedor activo.
    """

    ENGINE = "engine"
    FAKE = "fake"
    LEGACY = "legacy"
