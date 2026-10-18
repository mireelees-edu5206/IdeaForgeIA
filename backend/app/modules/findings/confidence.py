"""Tope de confianza por reglas: la IA propone el nivel, la evidencia decide el máximo."""

from dataclasses import dataclass

from app.core.enums import Level
from app.modules.findings.models import EvidenceStance

_ORDER = {Level.UNDETERMINED: 0, Level.LOW: 1, Level.MEDIUM: 2, Level.HIGH: 3}


@dataclass(frozen=True, slots=True)
class ConfidenceDecision:
    level: Level
    capped: bool
    reason: str | None  # explicación en español si se aplicó el tope


def cap_confidence(
    proposed: Level, supporting_domains: set[str], stances: set[EvidenceStance]
) -> ConfidenceDecision:
    """- 1 dominio que respalda → máximo media.
    - Evidencia en contra → máximo media.
    - 2 o más dominios independientes que respaldan → puede ser alta.
    Indeterminada (con evidencia que respalda) se trata como baja.
    """
    level = Level.LOW if proposed == Level.UNDETERMINED else proposed
    reasons = []
    if len(supporting_domains) < 2:
        reasons.append("solo una fuente independiente la respalda")
    if EvidenceStance.CONTRADICTS in stances:
        reasons.append("hay evidencia en contra")
    if reasons and _ORDER[level] > _ORDER[Level.MEDIUM]:
        return ConfidenceDecision(
            Level.MEDIUM, True, "Nivel limitado a 'media' por reglas: " + " y ".join(reasons) + "."
        )
    return ConfidenceDecision(level, False, None)
