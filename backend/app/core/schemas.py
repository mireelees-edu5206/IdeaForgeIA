from typing import Annotated, Self

from fastapi import Query
from pydantic import BaseModel, ConfigDict, model_validator

MAX_PAGE_SIZE = 100


class Page[T](BaseModel):
    items: list[T]
    total: int
    limit: int
    offset: int


class PageParams(BaseModel):
    limit: int = 20
    offset: int = 0


def page_params(
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PageParams:
    return PageParams(limit=limit, offset=offset)


class PatchModel(BaseModel):
    """Base para PATCH: campos opcionales, pero si se envían no pueden ser null."""

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> Self:
        nulls = [name for name in self.model_fields_set if getattr(self, name) is None]
        if nulls:
            raise ValueError(f"Los campos no pueden ser nulos: {', '.join(sorted(nulls))}.")
        return self
