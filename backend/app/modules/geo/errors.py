"""Declara errores tipados del dominio. Area: geografia."""

from app.core.errors import ServiceUnavailableError


class GeoProviderUnavailableError(ServiceUnavailableError):
    """Error que representa geografico proveedor unavailable."""

    code = "geo_provider_unavailable"
    message = "El servicio de mapas no está disponible temporalmente."
