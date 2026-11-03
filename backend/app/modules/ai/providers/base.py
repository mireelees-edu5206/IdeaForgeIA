"""Define el contrato comun de adaptadores. Area: proveedores de IA.

ARCHIVO: backend/app/modules/ai/providers/base.py

¿Qué es?
La "forma" que debe tener cualquier proveedor de IA: Gemini, Ollama o el de prueba. Define dos
acciones obligatorias: pedir datos estructurados y pedir texto con fuentes de internet.

¿Para qué sirve?
Para que el sistema pueda cambiar de proveedor sin cambiar el código de los servicios. Cada
proveedor implementa las mismas dos acciones, aunque por dentro funcionen distinto.

¿Quién lo usa?
- Los proveedores concretos (gemini.py, ollama.py, fake.py) lo implementan.
- factory.py y el orquestador lo usan sin saber qué proveedor es.
"""

from abc import ABC, abstractmethod
from collections.abc import Sequence

from pydantic import BaseModel

from app.core.enums import AIProviderName
from app.modules.ai.types import AIMessage, GroundedResult, StructuredResult


class AIProvider(ABC):
    """Contrato neutral para Gemini y modelos locales ejecutados con Ollama.

    Las implementaciones traducen sus errores a `AIProviderError` y nunca registran
    la API key ni el contenido completo de los prompts.
    """

    # Nombre del proveedor y del modelo. Cada implementación los define.
    name: AIProviderName
    model: str

    @abstractmethod
    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        """Pide una respuesta en JSON y la valida contra el esquema.

        Si la respuesta no cumple el esquema, lanza AIInvalidResponseError.
        """

    @abstractmethod
    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        """Pide una respuesta de texto basada en búsquedas web, con fuentes y citas."""

    async def aclose(self) -> None:  # noqa: B027 - opcional: cierra clientes HTTP
        """Cierra las conexiones del proveedor al apagar la aplicación. Por defecto no hace nada."""
