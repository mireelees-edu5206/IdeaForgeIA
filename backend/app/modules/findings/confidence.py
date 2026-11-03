"""Tope de confianza por reglas: la IA propone el nivel, la evidencia decide el máximo.

ARCHIVO: backend/app/modules/findings/confidence.py

¿Qué es?
Una regla sencilla que limita la confianza de un hallazgo. La IA puede decir "confianza alta",
pero este archivo revisa la evidencia y, si no alcanza, baja el nivel a "media".

¿Para qué sirve?
Para evitar que un hallazgo parezca más seguro de lo que realmente es. Por ejemplo, si solo una
fuente lo respalda, no puede quedar como "alta".

Reglas:
- Si solo 1 dominio independiente lo respalda, el máximo es "media".
- Si hay evidencia en contra, el máximo es "media".
- Solo con 2 o más dominios independientes que lo respalden puede ser "alta".
- Si la IA dice "indeterminada" pero hay evidencia que respalda, se trata como "baja".

¿Quién lo usa?
extraction.py (al guardar cada hallazgo que propone la IA).

Cambios comunes:
- Orden de niveles de confianza: _ORDER.
- Nivel máximo permitido cuando hay una limitación: Level.MEDIUM dentro de cap_confidence.
"""

from dataclasses import dataclass

from app.core.enums import Level
from app.modules.findings.models import EvidenceStance

# Qué tan alto es cada nivel. Un número más alto significa más confianza.
_ORDER = {Level.UNDETERMINED: 0, Level.LOW: 1, Level.MEDIUM: 2, Level.HIGH: 3}


@dataclass(frozen=True, slots=True)
class ConfidenceDecision:
    """El resultado de aplicar las reglas: el nivel final y si fue recortado."""

    level: Level  # Nivel final que se guarda.
    capped: bool  # True si el nivel se bajó por las reglas.
    reason: str | None  # Explicación en español si se aplicó el tope; vacía si no.


def cap_confidence(
    proposed: Level, supporting_domains: set[str], stances: set[EvidenceStance]
) -> ConfidenceDecision:
    """Decide el nivel final de confianza de un hallazgo.

    - proposed: el nivel que propuso la IA.
    - supporting_domains: los dominios distintos que respaldan el hallazgo.
    - stances: si hay evidencia a favor (SUPPORTS) o en contra (CONTRADICTS).

    Indeterminada (con evidencia que respalda) se trata como baja.
    """
    # "Indeterminada" se convierte en "baja", porque ya hay evidencia que respalda.
    level = Level.LOW if proposed == Level.UNDETERMINED else proposed
    reasons = []
    # Con menos de 2 dominios independientes, la confianza no puede ser alta.
    if len(supporting_domains) < 2:
        reasons.append("solo una fuente independiente la respalda")
    # Si hay evidencia en contra, tampoco puede ser alta.
    if EvidenceStance.CONTRADICTS in stances:
        reasons.append("hay evidencia en contra")
    # Solo se recorta si hay una razón y el nivel está por encima de "media".
    if reasons and _ORDER[level] > _ORDER[Level.MEDIUM]:
        return ConfidenceDecision(
            Level.MEDIUM, True, "Nivel limitado a 'media' por reglas: " + " y ".join(reasons) + "."
        )
    return ConfidenceDecision(level, False, None)
