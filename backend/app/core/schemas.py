"""Reglas de entrada y salida que se comparten entre varios módulos.

ARCHIVO: backend/app/core/schemas.py

¿Qué es?
Piezas reutilizables para los esquemas (las "fichas" que validan los datos que llegan y salen
de la API):
- MAX_PAGE_SIZE: el máximo de elementos que se puede pedir de una vez (100).
- Page: una página de resultados (lista, total, límite y desplazamiento).
- PageParams y page_params: los parámetros de paginación (limit y offset) de la URL.
- PatchModel: base para los cambios parciales (PATCH). Permite no mandar un campo, pero no
  permite mandarlo con valor null.

¿Quién lo usa?
Los routers de casi todos los módulos (proyectos, hallazgos, competidores, etc.) para listar
resultados y para actualizar datos.
"""

from typing import Annotated, Self

from fastapi import Query
from pydantic import BaseModel, ConfigDict, model_validator

# Máximo de elementos por página. Si cambias este número, también cambia el límite que acepta la
# API.
MAX_PAGE_SIZE = 100


class Page[T](BaseModel):
    """Una página de resultados.

    - items: los elementos de esta página.
    - total: cuántos elementos hay en total (sin contar la paginación).
    - limit: cuántos elementos se pidieron por página.
    - offset: cuántos elementos se saltaron antes de esta página.
    """

    items: list[T]
    total: int
    limit: int
    offset: int


class PageParams(BaseModel):
    """Los parámetros de paginación ya validados. Por defecto: 20 elementos desde el inicio."""

    limit: int = 20
    offset: int = 0


def page_params(
    # "Query(ge=1, le=100)" significa: entre 1 y 100. Si la URL manda otro número, la API responde
    # error.
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 20,
    # "ge=0": el desplazamiento no puede ser negativo.
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PageParams:
    """Lee limit y offset de la URL y devuelve los parámetros ya validados."""
    return PageParams(limit=limit, offset=offset)


class PatchModel(BaseModel):
    """Base para los cambios parciales (PATCH).

    Cada campo es opcional. Pero si la persona manda un campo, no puede ser null: borrar un valor
    obligatorio no se permite. Los campos que no se mandan no se tocan.
    """

    # "extra=forbid" rechaza campos que no existen en el esquema, para detectar errores de
    # escritura.
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> Self:
        """Rechaza los campos que llegaron con valor null (vacío)."""
        # "model_fields_set" son los campos que realmente vinieron en la petición.
        nulls = [name for name in self.model_fields_set if getattr(self, name) is None]
        if nulls:
            raise ValueError(f"Los campos no pueden ser nulos: {', '.join(sorted(nulls))}.")
        return self
