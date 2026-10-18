import pytest

from app.modules.research.models import SourceType
from app.modules.research.urls import guess_source_type, normalize_url


@pytest.mark.parametrize(
    ("raw", "canonical", "domain"),
    [
        ("https://www.Example.com/a/b/", "https://example.com/a/b", "example.com"),
        ("http://example.com", "https://example.com/", "example.com"),
        ("https://example.com:443/x#frag", "https://example.com/x", "example.com"),
        ("https://example.com:8080/x", "https://example.com:8080/x", "example.com"),
        (
            "https://example.com/p?b=2&utm_source=x&a=1&fbclid=y",
            "https://example.com/p?a=1&b=2",
            "example.com",
        ),
        ("  https://sub.example.org/p  ", "https://sub.example.org/p", "sub.example.org"),
    ],
)
def test_normalize_url(raw: str, canonical: str, domain: str) -> None:
    normalized = normalize_url(raw)
    assert normalized is not None
    assert normalized.canonical == canonical
    assert normalized.domain == domain


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "javascript:alert(1)",
        "ftp://example.com/a",
        "data:text/html,hola",
        "https://localhost/a",
        "https://user:pass@example.com/",
        "https://example.com:99999/",
        "https://example.com/" + "a" * 3000,
    ],
)
def test_normalize_url_rejects_invalid(raw: str) -> None:
    assert normalize_url(raw) is None


@pytest.mark.parametrize(
    ("domain", "expected"),
    [
        ("inegi.org.mx", SourceType.UNKNOWN),
        ("www.gob.mx", SourceType.GOVERNMENT),
        ("data.gov", SourceType.GOVERNMENT),
        ("unam.edu.mx", SourceType.ACADEMIC),
        ("ox.ac.uk", SourceType.ACADEMIC),
        ("example.com", SourceType.UNKNOWN),
    ],
)
def test_guess_source_type(domain: str, expected: SourceType) -> None:
    assert guess_source_type(domain) == expected
