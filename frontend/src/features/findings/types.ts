/**
 * ARCHIVO: findings/types.ts
 *
 * ¿Qué es?
 * Son las "fichas de forma" de los resultados (hallazgos), las entidades (nombres de empresas o
 * productos que aparecen en los resultados) y los competidores (alternativas que la persona decide
 * considerar). Describen cómo se ve cada cosa, sin dibujar nada.
 *
 * ¿Para qué sirve?
 * TypeScript usa estas fichas para avisar si se escribe mal un campo o un nivel de confianza
 * que no existe, antes de que la app se ejecute.
 *
 * ¿Quién lo usa?
 * api.ts, queries.ts, constants.ts y todas las pantallas y tarjetas de findings.
 *
 * Vocabulario:
 * - "Finding" = un resultado: una frase que afirma algo, con evidencia de respaldo.
 * - "Evidence" = el fragmento de una fuente que respalda (o contradice) ese resultado.
 * - "Entity" = un nombre que aparece en los resultados (empresa, producto, tecnología).
 * - "Competitor" = una entidad que la persona decidió tratar como alternativa del proyecto.
 */

/* "Origin" dice quién escribió algo: la IA o la persona. Viene de la carpeta de proyectos. */
import type { Origin } from "../projects/types";
/* Categoría de tema y tipo de sitio, definidos en la carpeta de investigación. */
import type { ResearchCategory, SourceType } from "../research/types";

/**
 * Level es el nivel de confianza o de riesgo: "high" (alto), "medium" (medio), "low" (bajo)
 * o "undetermined" (todavía no se sabe).
 */
/** Describe el contrato level utilizado por findings. */
export type Level = "low" | "medium" | "high" | "undetermined";
/**
 * ReviewStatus es el estado de revisión de un resultado o competidor:
 * "proposed" (sin revisar), "accepted" (aceptado por la persona) o "rejected" (descartado).
 */
/** Describe el contrato review status utilizado por findings. */
export type ReviewStatus = "proposed" | "accepted" | "rejected";
/**
 * EvidenceStance es si la evidencia apoya el resultado ("supports"), lo contradice ("contradicts")
 * o solo da contexto ("context"). Una contradicción es importante: no debe pasar desapercibida.
 */
/** Describe el contrato evidence stance utilizado por findings. */
export type EvidenceStance = "supports" | "contradicts" | "context";
/** Tipo de entidad: empresa, producto, tecnología, organización u otra cosa. */
/** Describe el contrato entity type utilizado por findings. */
export type EntityType = "company" | "product" | "technology" | "organization" | "other";
/**
 * CompetitorType es qué tan parecida es la alternativa: "direct" (muy parecida), "indirect" (otra forma
 * de resolver el mismo problema), "substitute" (podría reemplazar la propuesta) o "alternative" (otra manera, incluso hacerlo solo).
 */
/** Describe el contrato competitor type utilizado por findings. */
export type CompetitorType = "direct" | "indirect" | "substitute" | "alternative";

/**
 * FindingEvidence es una pieza de evidencia dentro de un resultado:
 * - evidence_id: su identificador.
 * - stance: si respalda, contradice o solo da contexto.
 * - content: el fragmento de texto tomado de la fuente.
 * - source: de qué página viene (id, dirección, dominio, título y tipo).
 */
/** Describe el contrato finding evidence utilizado por findings. */
export interface FindingEvidence {
  evidence_id: string;
  stance: EvidenceStance;
  content: string;
  source: { id: string; url: string; domain: string; title: string | null; source_type: SourceType };
}

/**
 * Finding es un resultado completo:
 * - statement: la frase que afirma algo (por ejemplo "los restaurantes compran verdura dos veces por semana").
 * - origin y review_status: quién lo escribió y si ya se revisó.
 * - finding_type: el tema (mercado, clientes...).
 * - confidence_level y confidence_rationale: qué tan confiable parece y por qué (o null si no hay explicación).
 * - run_id: la búsqueda de la que salió (o null si lo escribió la persona).
 * - evidence: las fuentes que lo respaldan o contradicen.
 * - entities: los nombres que se mencionan en el resultado.
 */
/** Describe el contrato finding utilizado por findings. */
export interface Finding {
  id: string;
  run_id: string | null;
  origin: Origin;
  review_status: ReviewStatus;
  finding_type: ResearchCategory;
  statement: string;
  confidence_level: Level;
  confidence_rationale: string | null;
  created_at: string;
  updated_at: string;
  evidence: FindingEvidence[];
  entities: Array<{ id: string; name: string; entity_type: EntityType }>;
}

/**
 * FindingInput son los datos para crear o editar un resultado escrito por la persona:
 * tema, texto, nivel de confianza y justificación (opcional).
 */
/** Describe el contrato finding input utilizado por findings. */
export interface FindingInput {
  finding_type: ResearchCategory;
  statement: string;
  confidence_level: Level;
  confidence_rationale?: string;
}

/**
 * FindingFilters son los filtros de la lista de resultados. Cada campo es opcional:
 * si no viene, no se filtra por ese criterio.
 */
/** Describe el contrato finding filters utilizado por findings. */
export interface FindingFilters {
  run_id?: string;
  finding_type?: ResearchCategory;
  review_status?: ReviewStatus;
}

/**
 * EntityBrief es la ficha corta de un nombre: id, tipo, nombre, sitio web y descripción (esta última puede faltar).
 */
/** Describe el contrato entity brief utilizado por findings. */
export interface EntityBrief {
  id: string;
  entity_type: EntityType;
  name: string;
  website: string | null;
  description: string | null;
}

/**
 * Entity es un nombre que aparece en los resultados, con cuántos resultados lo mencionan.
 * competitor_id dice si ya se convirtió en competidor (null si todavía no).
 */
/** Describe el contrato entity utilizado por findings. */
export interface Entity extends EntityBrief {
  finding_count: number;
  competitor_id: string | null;
}

/**
 * Competitor es una alternativa del proyecto: la entidad, qué tan parecida es, qué tan fuerte parece,
 * quién la añadió, su revisión y en cuántos resultados aparece.
 */
/** Describe el contrato competitor utilizado por findings. */
export interface Competitor {
  id: string;
  entity: EntityBrief;
  competitor_type: CompetitorType;
  threat_level: Level;
  rationale: string | null;
  origin: Origin;
  review_status: ReviewStatus;
  run_id: string | null;
  finding_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * CompetitorInput son los datos para añadir un competidor. Puede venir de una entidad ya existente
 * (entity_id) o de un nombre nuevo (name, con website opcional).
 */
/** Describe el contrato competitor input utilizado por findings. */
export interface CompetitorInput {
  entity_id?: string;
  name?: string;
  website?: string;
  competitor_type: CompetitorType;
  threat_level?: Level;
  rationale?: string;
}

/**
 * CompetitorUpdate son los campos que se pueden cambiar de un competidor: tipo, nivel de amenaza,
 * revisión y justificación. "Partial" y "Pick" significan "solo algunos de estos campos".
 */
/** Describe el contrato competitor update utilizado por findings. */
export type CompetitorUpdate = Partial<Pick<Competitor, "competitor_type" | "threat_level" | "review_status">> & {
  rationale?: string;
};
