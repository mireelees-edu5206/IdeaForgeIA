"""Declara los errores tipados de geografía. Area: geografia.

ARCHIVO: backend/app/modules/geo/errors.py

¿Qué es?
El error que se lanza cuando el proveedor de mapas no responde o limita las solicitudes.

¿Para qué sirve?
Para que el frontend reciba un código estable (`geo_provider_unavailable`) con un mensaje claro, sin
detalles técnicos del proveedor.

¿Quién lo usa?
`providers/openstreetmap.py` lo lanza; el manejador global de errores lo convierte en la respuesta
HTTP 503.
"""

from app.core.errors import ServiceUnavailableError


class GeoProviderUnavailableError(ServiceUnavailableError):
    """Se lanza cuando Nominatim u Overpass no responden o limitan las solicitudes."""

    code = "geo_provider_unavailable"
    message = "El servicio de mapas no está disponible temporalmente."
