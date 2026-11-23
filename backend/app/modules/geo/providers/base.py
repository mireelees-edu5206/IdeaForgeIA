"""Define el contrato que cumple todo proveedor geográfico. Area: geografia.

ARCHIVO: backend/app/modules/geo/providers/base.py

¿Qué es?
La clase abstracta `GeoProvider`, con tres métodos: `geocode` (texto a coordenadas), `find_places`
(lugares alrededor de una coordenada) y `aclose` (libera recursos, opcional).

¿Para qué sirve?
Para que `GeoService` y el laboratorio hablen con cualquier proveedor sin conocer sus URLs ni sus
formatos de respuesta.

¿Quién lo usa?
`providers/openstreetmap.py` lo implementa; `service.py` y `admin/lab` lo reciben como dependencia.
"""

from abc import ABC, abstractmethod

from app.modules.geo.schemas import GeoBusiness, GeoCategory, GeoPlace


class GeoProvider(ABC):
    """Contrato para servicios de geocodificación y puntos de interés."""

    @abstractmethod
    async def geocode(self, query: str) -> list[GeoPlace]:
        """Convierte una búsqueda escrita en posibles coordenadas."""

    @abstractmethod
    async def find_places(
        self,
        latitude: float,
        longitude: float,
        radius_m: int,
        category: GeoCategory,
        keyword: str | None = None,
    ) -> list[GeoBusiness]:
        """Busca puntos cartografiados alrededor de unas coordenadas."""

    async def aclose(self) -> None:  # noqa: B027 - opcional: libera recursos del proveedor
        """Cierra recursos del proveedor si los tiene."""
