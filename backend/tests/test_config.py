import pytest
from pydantic import ValidationError

from app.core.config import Settings
from tests.conftest import make_settings


def test_cors_origins_parsed_from_comma_separated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173/, https://app.example.com")
    settings = Settings(_env_file=None)
    assert settings.cors_origins == ["http://localhost:5173", "https://app.example.com"]


def test_cors_wildcard_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "*")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_short_secret_key_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECRET_KEY", "corta")
    monkeypatch.setenv("LEGACY_AUTH_ENABLED", "true")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_legacy_secret_is_not_required_when_disabled() -> None:
    settings = make_settings(secret_key=None, legacy_auth_enabled=False)
    assert settings.secret_key is None


def test_public_geo_providers_require_https_origins() -> None:
    with pytest.raises(ValidationError):
        make_settings(geo_nominatim_url="http://nominatim.example")

    settings = make_settings()
    assert settings.geo_provider == "openstreetmap"
    assert settings.geo_nominatim_url == "https://nominatim.openstreetmap.org"
