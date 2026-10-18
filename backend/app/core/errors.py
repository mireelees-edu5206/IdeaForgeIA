import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Error de dominio con respuesta controlada. Nunca incluye detalles internos."""

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
        self.message = message or self.message
        self.code = code or self.code
        self.headers = headers or self.headers
        self.details = details
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"
    message = "El recurso solicitado no existe."


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"
    message = "La operación entra en conflicto con el estado actual."


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"
    message = "Se requiere autenticación."
    headers = {"WWW-Authenticate": "Bearer"}


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"
    message = "No tienes permiso para realizar esta acción."


class TooManyRequestsError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "too_many_requests"
    message = "Demasiadas solicitudes. Inténtalo más tarde."


class ServiceUnavailableError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "service_unavailable"
    message = "El servicio no está disponible temporalmente."


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
    error: dict[str, Any] = {"code": code, "message": message}
    if details:
        error["details"] = details
    return JSONResponse(status_code=status_code, content={"error": error}, headers=headers)


async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return error_response(
        exc.status_code, exc.code, exc.message, details=exc.details, headers=exc.headers
    )


async def _http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code, message = _HTTP_ERRORS.get(exc.status_code, ("http_error", "Error en la solicitud."))
    return error_response(exc.status_code, code, message, headers=exc.headers)


# Traducción de los tipos de error de Pydantic más comunes (la interfaz es solo en español).
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
    if err["type"] == "string_too_short" and err.get("ctx", {}).get("min_length") == 1:
        return "Este campo no puede estar vacío."
    template = _VALIDATION_MESSAGES.get(err["type"])
    if template is None:
        return "El valor no es válido."
    try:
        return template.format(**err.get("ctx", {}))
    except (KeyError, IndexError):
        return "El valor no es válido."


async def _validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Solo campo y mensaje: nunca se devuelve el valor recibido.
    details = [
        {
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
    logger.exception("Error no controlado en %s %s", request.method, request.url.path)
    return error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR, "internal_error", "Ocurrió un error interno."
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(Exception, _unhandled_error_handler)
