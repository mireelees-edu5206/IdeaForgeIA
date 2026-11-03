"""Errores del sistema y cómo se convierten en respuestas para el navegador.

ARCHIVO: backend/app/core/errors.py

¿Qué es?
Dos cosas:
1. Las clases de error propias (por ejemplo NotFoundError, ConflictError, UnauthorizedError).
   Cada una tiene un código HTTP, un código corto y un mensaje en español.
2. Los "manejadores" que convierten cualquier error en una respuesta JSON con este formato:
   {"error": {"code": "...", "message": "...", "details": [...]}}

¿Para qué sirve?
Para que el frontend siempre reciba errores con la misma forma y con mensajes seguros. Nunca se
muestran detalles internos (rutas de archivos, consultas SQL o trazas), solo el mensaje público.

¿Quién lo usa?
- Los servicios y routers lanzan estas clases cuando algo no se puede hacer.
- main.py llama register_exception_handlers para conectarlos.
- El frontend lee el campo "code" y "message" (lib/apiClient.ts).

Cambios comunes:
- Mensaje de un error: cambia el texto por defecto de la clase (message).
- Traducción de un error de validación: cambia _VALIDATION_MESSAGES.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Error del dominio con respuesta controlada. Nunca incluye detalles internos.

    Las subclases solo cambian sus valores por defecto (código HTTP, código y mensaje).
    """

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "bad_request"
    message: str = "La solicitud no es válida."
    headers: dict[str, str] | None = None

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        headers: dict[str, str] | None = None,
        details: list[dict[str, Any]] | None = None,
    ) -> None:
        """Crea el error. Si no se da un mensaje o código, usa los valores por defecto de la
        clase."""
        self.message = message or self.message
        self.code = code or self.code
        self.headers = headers or self.headers
        self.details = details
        super().__init__(self.message)


class NotFoundError(AppError):
    """El recurso no existe, o no pertenece a quien lo pidió. Responde 404."""

    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"
    message = "El recurso solicitado no existe."


class ConflictError(AppError):
    """La operación choca con el estado actual (por ejemplo, un correo ya usado). Responde 409."""

    status_code = status.HTTP_409_CONFLICT
    code = "conflict"
    message = "La operación entra en conflicto con el estado actual."


class UnauthorizedError(AppError):
    """Falta el inicio de sesión o el token no sirve. Responde 401 y pide Bearer."""

    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"
    message = "Se requiere autenticación."
    # El encabezado WWW-Authenticate le dice al navegador qué tipo de autenticación se espera.
    headers = {"WWW-Authenticate": "Bearer"}


class ForbiddenError(AppError):
    """Hay sesión, pero la cuenta no tiene permiso para esta acción. Responde 403."""

    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"
    message = "No tienes permiso para realizar esta acción."


class TooManyRequestsError(AppError):
    """Demasiados intentos en poco tiempo (por ejemplo, login). Responde 429."""

    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "too_many_requests"
    message = "Demasiadas solicitudes. Inténtalo más tarde."


class ServiceUnavailableError(AppError):
    """Un servicio externo o una configuración falta. Responde 503 (temporal)."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "service_unavailable"
    message = "El servicio no está disponible temporalmente."


# Mensajes para los errores HTTP normales de FastAPI/Starlette (por número de estado).
# Cada entrada es: número de estado -> (código, mensaje en español).
_HTTP_ERRORS: dict[int, tuple[str, str]] = {
    400: ("bad_request", "La solicitud no es válida."),
    401: ("unauthorized", "Se requiere autenticación."),
    403: ("forbidden", "No tienes permiso para realizar esta acción."),
    404: ("not_found", "El recurso solicitado no existe."),
    405: ("method_not_allowed", "Método no permitido."),
    409: ("conflict", "La operación entra en conflicto con el estado actual."),
    429: ("too_many_requests", "Demasiadas solicitudes. Inténtalo más tarde."),
}


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: list[dict[str, Any]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    """Arma la respuesta JSON de error con la forma {"error": {...}}."""
    error: dict[str, Any] = {"code": code, "message": message}
    # "details" solo aparece si hay algo que contar (por ejemplo, qué campo falló).
    if details:
        error["details"] = details
    return JSONResponse(status_code=status_code, content={"error": error}, headers=headers)


async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    """Convierte un AppError en su respuesta JSON."""
    return error_response(
        exc.status_code, exc.code, exc.message, details=exc.details, headers=exc.headers
    )


async def _http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Convierte un error HTTP normal en la misma forma de respuesta."""
    # Si el número de estado no está en la lista, usamos un mensaje genérico.
    code, message = _HTTP_ERRORS.get(exc.status_code, ("http_error", "Error en la solicitud."))
    return error_response(exc.status_code, code, message, headers=exc.headers)


# Traducción de los tipos de error de Pydantic más comunes (la interfaz es solo en español).
# Cada tipo de error de validación se cambia por un mensaje claro.
_VALIDATION_MESSAGES: dict[str, str] = {
    "missing": "Este campo es obligatorio.",
    "string_too_short": "Debe tener al menos {min_length} caracteres.",
    "string_too_long": "Debe tener como máximo {max_length} caracteres.",
    "string_type": "Debe ser un texto.",
    "value_error": "El valor no es válido.",
    "json_invalid": "El cuerpo de la solicitud no es un JSON válido.",
    "model_attributes_type": "El cuerpo de la solicitud no tiene el formato esperado.",
    "extra_forbidden": "Campo no permitido.",
    "enum": "Valor no permitido.",
    "literal_error": "Valor no permitido.",
    "uuid_parsing": "Identificador no válido.",
    "int_parsing": "Debe ser un número entero.",
    "bool_parsing": "Debe ser verdadero o falso.",
}


def _validation_message(err: dict[str, Any]) -> str:
    """Elige el mensaje público para un error de validación.

    Caso especial: un texto de longitud mínima 1 significa que el campo no puede estar vacío.
    """
    if err["type"] == "string_too_short" and err.get("ctx", {}).get("min_length") == 1:
        return "Este campo no puede estar vacío."
    template = _VALIDATION_MESSAGES.get(err["type"])
    if template is None:
        return "El valor no es válido."
    # Rellena el mensaje con los datos del error (por ejemplo, el mínimo permitido).
    try:
        return template.format(**err.get("ctx", {}))
    except (KeyError, IndexError):
        return "El valor no es válido."


async def _validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Traduce errores de Pydantic a detalles públicos sin devolver valores recibidos."""
    # Solo campo y mensaje: nunca se devuelve el valor recibido, por seguridad.
    details = [
        {
            # "loc" es la ruta del campo, por ejemplo ("body", "title"). Se quita la palabra "body".
            "field": ".".join(str(part) for part in err["loc"] if part != "body"),
            "message": _validation_message(err),
        }
        for err in exc.errors()
    ]
    return error_response(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "validation_error",
        "Los datos enviados no son válidos.",
        details,
    )


async def _unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Último recurso: cualquier error no previsto. Lo registra en el log y responde algo
    genérico."""
    # El detalle real solo va al log del servidor, nunca a la respuesta.
    logger.exception("Error no controlado en %s %s", request.method, request.url.path)
    return error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR, "internal_error", "Ocurrió un error interno."
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Conecta cada tipo de error con su manejador. Se llama una vez al crear la aplicación."""
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(Exception, _unhandled_error_handler)
