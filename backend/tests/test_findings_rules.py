import pytest

from app.core.enums import Level
from app.modules.entities.normalize import normalize_entity_name
from app.modules.findings.confidence import cap_confidence
from app.modules.findings.models import EvidenceStance

S, C, X = EvidenceStance.SUPPORTS, EvidenceStance.CONTRADICTS, EvidenceStance.CONTEXT


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Mercado Fresco S.A. de C.V.", "mercado fresco"),
        ("  Café  Único, Inc. ", "cafe unico"),
        ("ACME LLC", "acme"),
        ("Rappi", "rappi"),
        ("S.A.", "s a"),  # si solo queda el sufijo, se conserva
    ],
)
def test_normalize_entity_name(raw: str, expected: str) -> None:
    assert normalize_entity_name(raw) == expected


@pytest.mark.parametrize(
    ("proposed", "domains", "stances", "level", "capped"),
    [
        (Level.HIGH, {"a.com", "b.org"}, {S}, Level.HIGH, False),
        (Level.HIGH, {"a.com"}, {S}, Level.MEDIUM, True),
        (Level.HIGH, {"a.com", "b.org"}, {S, C}, Level.MEDIUM, True),
        (Level.MEDIUM, {"a.com"}, {S, X}, Level.MEDIUM, False),
        (Level.LOW, {"a.com"}, {S}, Level.LOW, False),
        (Level.UNDETERMINED, {"a.com"}, {S}, Level.LOW, False),
    ],
)
def test_cap_confidence(
    proposed: Level, domains: set[str], stances: set, level: Level, capped: bool
) -> None:
    decision = cap_confidence(proposed, domains, stances)
    assert decision.level == level
    assert decision.capped is capped
    assert (decision.reason is not None) is capped
