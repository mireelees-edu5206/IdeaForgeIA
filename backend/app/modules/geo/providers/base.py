from abc import ABC, abstractmethod

from app.modules.geo.schemas import GeoBusiness, GeoCategory, GeoPlace


class GeoProvider(ABC):
    """Contrato para servicios de geocodificación y puntos de interés."""

    @abstractmethod
    async def geocode(self, query: str) -> list[GeoPlace]:
        """Convierte una búsqueda escrita en posibles coordenadas."""

    @abstractmethod
    async def find_places(
        self, latitude: float, longitude: float, radius_m: int, category: GeoCategory
    ) -> list[GeoBusiness]:
        """Busca puntos cartografiados alrededor de unas coordenadas."""

    async def aclose(self) -> None:  # noqa: B027 - opcional: libera recursos del proveedor
        """Cierra recursos del proveedor si los tiene."""
