"""Define la interfaz común que cumple todo proveedor de IA. Area: proveedores de IA.

ARCHIVO: backend/app/modules/ai/providers/base.py

¿Qué es?
La clase abstracta `AIProvider`, con dos acciones obligatorias: pedir datos estructurados (JSON
validado contra un esquema) y pedir texto basado en búsquedas, con fuentes y citas.

¿Para qué sirve?
Para que el sistema pueda cambiar de proveedor sin cambiar el código de los servicios. Hoy hay dos
implementaciones: el motor propio (`engine.py`) y el de pruebas (`fake.py`). Gemini y Ollama
fueron retirados.

¿Quién lo usa?
- `engine.py` y `fake.py` lo implementan.
- `factory.py` y `orchestrator.py` lo usan sin saber qué proveedor es.
"""

from abc import ABC, abstractmethod
from collections.abc import Sequence

from pydantic import BaseModel

from app.core.enums import AIProviderName
from app.modules.ai.types import AIMessage, GroundedResult, StructuredResult


class AIProvider(ABC):
    """Contrato común de todos los proveedores de IA (motor propio y de pruebas).

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
