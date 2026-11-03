"""Aplica reglas de negocio y permisos. Area: resultados/evidencia.

ARCHIVO: backend/app/modules/findings/service.py

¿Qué es?
Las reglas de los resultados. Decide qué se puede crear, cambiar o borrar, y arma los datos que
recibe el frontend.

¿Para qué sirve?
Para que nadie cambie un hallazgo de la IA sin que quede registrado, y para que no se borre una
evidencia de la que dependen otros datos.

¿Quién lo usa?
router.py (cada endpoint de resultados llama a un método de FindingService).

Reglas principales:
- Solo el dueño del proyecto puede ver o cambiar sus resultados.
- Crear un resultado propio deja la persona como autora (origin = user) y lo acepta de inmediato.
- Cambiar el contenido de un hallazgo de la IA lo convierte en dato del usuario.
  Deja de ser de la IA.
- Los hallazgos de la IA no se borran (para conservar la trazabilidad); solo se pueden rechazar.
- Las evidencias y entidades que se vinculan deben existir en el mismo proyecto.
"""

import uuid
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Origin, ResearchCategory, ReviewStatus
from app.core.errors import AppError, ConflictError, NotFoundError
from app.modules.entities.repository import EntityRepository
from app.modules.findings.models import Finding, FindingEntity, FindingEvidence
from app.modules.findings.repository import FindingRepository
from app.modules.findings.schemas import (
    EvidenceSourceRead,
    FindingCreate,
    FindingEntityRead,
    FindingEvidenceRead,
    FindingRead,
    FindingUpdate,
)
from app.modules.projects.service import get_owned_project
from app.modules.users.models import User

# Si cambia alguno de estos campos en un hallazgo de la IA, pasa a ser dato del usuario.
_CONTENT_FIELDS = ("finding_type", "statement", "confidence_level", "confidence_rationale")


class FindingNotFoundError(NotFoundError):
    """El hallazgo no existe en ese proyecto. Responde 404."""

    code = "finding_not_found"
    message = "El hallazgo no existe."


class FindingService:
    """Reglas de negocio de los resultados para cada petición de la API."""

    def __init__(self, session: AsyncSession) -> None:
        """Crea los repositorios de hallazgos y entidades con la misma sesión."""
        self.session = session
        self.findings = FindingRepository(session)
        self.entities = EntityRepository(session)

    async def _to_read(self, findings: list[Finding]) -> list[FindingRead]:
        """Convierte hallazgos de la base de datos en datos listos para el frontend.

        Junta las evidencias y las entidades de todos los hallazgos con dos consultas en lugar de
        hacer una por hallazgo.
        """
        ids = [f.id for f in findings]
        # Agrupa las evidencias por hallazgo: { id_del_hallazgo: [evidencia, ...] }.
        evidence: dict[uuid.UUID, list[FindingEvidenceRead]] = defaultdict(list)
        for link, item, source in await self.findings.evidence_for(ids):
            evidence[link.finding_id].append(
                FindingEvidenceRead(
                    evidence_id=item.id,
                    stance=link.stance,
                    content=item.content,
                    source=EvidenceSourceRead(
                        id=source.id,
                        url=source.url,
                        domain=source.domain,
                        title=source.title,
                        source_type=source.source_type,
                    ),
                )
            )
        # Agrupa las entidades por hallazgo, igual que las evidencias.
        entities: dict[uuid.UUID, list[FindingEntityRead]] = defaultdict(list)
        for link, entity in await self.findings.entities_for(ids):
            entities[link.finding_id].append(
                FindingEntityRead(id=entity.id, name=entity.name, entity_type=entity.entity_type)
            )
        # "model_copy" crea una copia del dato con las listas de evidencias y entidades ya llenas.
        return [
            FindingRead.model_validate(f).model_copy(
                update={"evidence": evidence[f.id], "entities": entities[f.id]}
            )
            for f in findings
        ]

    async def _get(self, user: User, project_id: uuid.UUID, finding_id: uuid.UUID) -> Finding:
        """Busca un hallazgo del proyecto del usuario. Si no existe, lanza 404."""
        project = await get_owned_project(self.session, user, project_id)
        finding = await self.findings.get(project.id, finding_id)
        if finding is None:
            raise FindingNotFoundError()
        return finding

    async def list_findings(
        self,
        user: User,
        project_id: uuid.UUID,
        run_id: uuid.UUID | None,
        finding_type: ResearchCategory | None,
        review_status: ReviewStatus | None,
    ) -> list[FindingRead]:
        """Lista los resultados del proyecto del usuario, con los filtros pedidos."""
        project = await get_owned_project(self.session, user, project_id)
        findings = await self.findings.list_for_project(
            project.id, run_id, finding_type, review_status
        )
        return await self._to_read(findings)

    async def create_finding(
        self, user: User, project_id: uuid.UUID, data: FindingCreate
    ) -> FindingRead:
        """Crea un hallazgo que escribe la persona.

        Antes de guardar, revisa que las evidencias y entidades indicadas existan
        en ese mismo proyecto.
        Si alguna no existe, responde error.
        """
        project = await get_owned_project(self.session, user, project_id)
        # Las tablas intermedias no llevan project_id: la pertenencia se comprueba aquí.
        links = {link.evidence_id: link.stance for link in data.evidence}
        if await self.findings.evidence_ids_in_project(project.id, set(links)) != set(links):
            raise AppError("Alguna evidencia no existe en este proyecto.", code="invalid_evidence")
        entity_ids = set(data.entity_ids)
        if await self.entities.ids_in_project(project.id, entity_ids) != entity_ids:
            raise AppError("Alguna entidad no existe en este proyecto.", code="invalid_entity")

        # El hallazgo nace como dato del usuario, ya aceptado. No tiene investigación de origen.
        finding = Finding(
            project_id=project.id,
            origin=Origin.USER,
            review_status=ReviewStatus.ACCEPTED,
            finding_type=data.finding_type,
            statement=data.statement,
            confidence_level=data.confidence_level,
            # Si la justificación viene vacía, se guarda como nulo.
            confidence_rationale=data.confidence_rationale or None,
        )
        self.findings.add(finding)
        # flush manda el hallazgo a la base para obtener su id, sin cerrar la transacción todavía.
        await self.session.flush()
        self.session.add_all(
            FindingEvidence(finding_id=finding.id, evidence_id=evidence_id, stance=stance)
            for evidence_id, stance in links.items()
        )
        self.session.add_all(FindingEntity(finding_id=finding.id, entity_id=e) for e in entity_ids)
        await self.session.commit()
        return (await self._to_read([finding]))[0]

    async def update_finding(
        self, user: User, project_id: uuid.UUID, finding_id: uuid.UUID, data: FindingUpdate
    ) -> FindingRead:
        """Cambia los campos que se mandan del hallazgo.

        Si cambia el contenido de un hallazgo de la IA, pasa a ser del usuario y queda aceptado.
        Si solo se cambia su revisión, se aplica tal cual.
        """
        finding = await self._get(user, project_id, finding_id)
        # Solo los campos que realmente se mandaron (exclude_unset): lo que no viene no se toca.
        changes = data.model_dump(exclude_unset=True)
        content = {k: v for k, v in changes.items() if k in _CONTENT_FIELDS}
        if any(getattr(finding, k) != v for k, v in content.items()):
            for field, value in content.items():
                # Una justificación vacía se guarda como nulo.
                if field == "confidence_rationale":
                    value = value or None
                setattr(finding, field, value)
            # El usuario asume el contenido: deja de ser una propuesta de la IA.
            finding.origin = Origin.USER
            finding.review_status = ReviewStatus.ACCEPTED
        if "review_status" in changes:
            finding.review_status = changes["review_status"]
        await self.session.commit()
        return (await self._to_read([finding]))[0]

    async def delete_finding(
        self, user: User, project_id: uuid.UUID, finding_id: uuid.UUID
    ) -> None:
        """Borra un hallazgo propio. Los de la IA no se pueden borrar: solo rechazar."""
        finding = await self._get(user, project_id, finding_id)
        if finding.origin != Origin.USER:
            raise ConflictError(
                "Los hallazgos de la IA no se borran para conservar la trazabilidad; recházalo.",
                code="ai_item_not_deletable",
            )
        await self.findings.delete(finding)
        await self.session.commit()
