from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints, field_validator

from app.modules.users.schemas import ExistingPassword, FullName, Password

RefreshTokenValue = Annotated[str, StringConstraints(min_length=1, max_length=256)]


class _EmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.lower()


class RegisterRequest(_EmailRequest):
    password: Password
    full_name: FullName


class LoginRequest(_EmailRequest):
    password: ExistingPassword


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: RefreshTokenValue


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int  # segundos de vida del access token
