from app.core.errors import ServiceUnavailableError


class GeoProviderUnavailableError(ServiceUnavailableError):
    code = "geo_provider_unavailable"
    message = "El servicio de mapas no está disponible temporalmente."
