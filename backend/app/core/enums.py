"""Enumeraciones de dominio compartidas entre módulos.

Los valores (en inglés) se guardan en la BD; el frontend los traduce a etiquetas en español.
"""

from enum import StrEnum


class Origin(StrEnum):
    """Representa procedencia."""

    AI = "ai"
    USER = "user"


class ReviewStatus(StrEnum):
    """Representa review estado."""

    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class Level(StrEnum):
    """Representa nivel."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    UNDETERMINED = "undetermined"


class Priority(StrEnum):
    """Representa priority."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ResearchCategory(StrEnum):
    """Representa investigacion categoria."""

    MARKET = "market"
    CUSTOMERS = "customers"
    COMPETITION = "competition"
    SUBSTITUTES = "substitutes"
    TECHNOLOGY = "technology"
    REGULATION = "regulation"
    PRICING = "pricing"
    OTHER = "other"


class AttributeType(StrEnum):
    """Representa atributo tipo."""

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
    """Representa aiprovider nombre."""

    GEMINI = "gemini"
    OLLAMA = "ollama"
    FAKE = "fake"
    LEGACY = "legacy"
