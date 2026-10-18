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

    name: AIProviderName
    model: str

    @abstractmethod
    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        """Respuesta JSON validada contra `schema` (lanza AIInvalidResponseError si no cumple)."""

    @abstractmethod
    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        """Respuesta basada en búsquedas web, con fuentes y fragmentos citados."""

    async def aclose(self) -> None:  # noqa: B027 - opcional: cierra clientes HTTP
        """Libera recursos al apagar la aplicación."""
