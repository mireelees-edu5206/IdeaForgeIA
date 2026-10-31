/**
 * ARCHIVO: findings/constants.ts
 *
 * ¿Qué es?
 * Es la "hoja de textos y colores fijos" de los resultados y competidores: los nombres de cada
 * nivel de confianza, de riesgo y de revisión, el texto de cada tipo de competidor, y los límites
 * de longitud de los textos.
 *
 * ¿Para qué sirve?
 * Cambiar un nombre o un color de esta pantalla se hace aquí. Por ejemplo, si cambias "Riesgo alto"
 * por otro texto, se actualiza en todas las tarjetas.
 *
 * ¿Quién lo usa?
 * FindingCard, FindingForm, CompetitorCard, CompetitorForm, CompetitorsTab, FindingsTab y badges.tsx.
 *
 * ⚠ Los límites (STATEMENT_MAX_LENGTH, RATIONALE_MAX_LENGTH) deben coincidir con el backend
 * (findings/schemas.py). Si cambias uno, cambia el otro.
 */

/* Tipos de nivel, revisión, postura, competidor y entidad. */
import type { CompetitorType, EntityType, EvidenceStance, Level, ReviewStatus } from "./types";

/** STATEMENT_MAX_LENGTH: el texto de un resultado puede tener hasta 2000 caracteres. */
/** Define statement max length como dato o funcion publica de findings. */
export const STATEMENT_MAX_LENGTH = 2000;
/** RATIONALE_MAX_LENGTH: la justificación puede tener hasta 2000 caracteres. */
/** Define rationale max length como dato o funcion publica de findings. */
export const RATIONALE_MAX_LENGTH = 2000;

/** LEVEL_VALUES: los niveles en el orden en que aparecen en los menús: alta, media, baja e indeterminada. */
/** Define level values como dato o funcion publica de findings. */
export const LEVEL_VALUES: Level[] = ["high", "medium", "low", "undetermined"];

/**
 * CONFIDENCE_META asigna a cada nivel de confianza su texto y colores. Cada línea es un nivel:
 * alta (verde), media (celeste), baja (ámbar) e indeterminada (gris).
 */
/** Define confidence meta como dato o funcion publica de findings. */
export const CONFIDENCE_META: Record<Level, { label: string; className: string }> = {
  high: { label: "Confianza alta", className: "text-emerald-200 bg-emerald-400/15 ring-emerald-300/30" },
  medium: { label: "Confianza media", className: "text-sky-200 bg-sky-400/15 ring-sky-300/30" },
  low: { label: "Confianza baja", className: "text-amber-200 bg-amber-400/15 ring-amber-300/30" },
  undetermined: { label: "Confianza indeterminada", className: "text-slate-300 bg-slate-400/15 ring-slate-300/25" },
};

/** LEVEL_LABELS: el nombre corto de cada nivel ("Alta", "Media"...), para los menús desplegables. */
/** Define level labels como dato o funcion publica de findings. */
export const LEVEL_LABELS: Record<Level, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
  undetermined: "Indeterminada",
};

/**
 * THREAT_META es igual que CONFIDENCE_META, pero para el riesgo que representa un competidor:
 * "Riesgo alto" (rojo), "Riesgo medio" (ámbar), "Riesgo bajo" (verde) y "Sin evaluar" (gris).
 */
/** Define threat meta como dato o funcion publica de findings. */
export const THREAT_META: Record<Level, { label: string; className: string }> = {
  high: { label: "Riesgo alto", className: "text-rose-200 bg-rose-400/15 ring-rose-300/30" },
  medium: { label: "Riesgo medio", className: "text-amber-200 bg-amber-400/15 ring-amber-300/30" },
  low: { label: "Riesgo bajo", className: "text-emerald-200 bg-emerald-400/15 ring-emerald-300/30" },
  undetermined: { label: "Sin evaluar", className: "text-slate-300 bg-slate-400/15 ring-slate-300/25" },
};

/** REVIEW_LABELS: el texto de cada estado de revisión: "Sin revisar", "Aceptado", "Rechazado". */
/** Define review labels como dato o funcion publica de findings. */
export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  proposed: "Sin revisar",
  accepted: "Aceptado",
  rejected: "Rechazado",
};

/**
 * STANCE_META dice qué hace la evidencia con el resultado: "Respalda" (verde), "Contradice" (rojo)
 * o "Contexto" (gris). Así la persona ve de un vistazo si una fuente va a favor o en contra.
 */
/** Define stance meta como dato o funcion publica de findings. */
export const STANCE_META: Record<EvidenceStance, { label: string; className: string }> = {
  supports: { label: "Respalda", className: "text-kind-evidence bg-kind-evidence/10 ring-kind-evidence/30" },
  contradicts: { label: "Contradice", className: "text-rose-200 bg-rose-400/15 ring-rose-300/30" },
  context: { label: "Contexto", className: "text-slate-300 bg-slate-400/15 ring-slate-300/25" },
};

/** COMPETITOR_TYPES: la lista de los cuatro tipos de competidor, en el orden de las cuatro anillas del mapa. */
/** Define competitor types como dato o funcion publica de findings. */
export const COMPETITOR_TYPES: CompetitorType[] = ["direct", "indirect", "substitute", "alternative"];

/**
 * COMPETITOR_TYPE_META explica cada tipo de competidor con tres textos:
 * - label: el nombre corto ("Muy parecida").
 * - plural: el nombre de grupo ("Opciones muy parecidas").
 * - description: la explicación en una frase, para que la persona entienda la diferencia.
 */
/** Define competitor type meta como dato o funcion publica de findings. */
export const COMPETITOR_TYPE_META: Record<CompetitorType, { label: string; plural: string; description: string }> = {
  direct: {
    label: "Muy parecida",
    plural: "Opciones muy parecidas",
    description: "Ofrecen algo similar para el mismo tipo de cliente.",
  },
  indirect: {
    label: "Otra forma",
    plural: "Otras formas de resolverlo",
    description: "Resuelven el mismo problema con un producto o servicio distinto.",
  },
  substitute: {
    label: "Reemplazo",
    plural: "Opciones que pueden reemplazarlo",
    description: "Algo diferente que el cliente podría usar en vez de tu propuesta.",
  },
  alternative: {
    label: "Alternativa",
    plural: "Otras alternativas",
    description: "Otras maneras de resolverlo, incluso hacerlo por cuenta propia.",
  },
};

/** ENTITY_TYPE_LABELS: el nombre en español de cada tipo de entidad (Empresa, Producto...). */
/** Define entity type labels como dato o funcion publica de findings. */
export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  company: "Empresa",
  product: "Producto",
  technology: "Tecnología",
  organization: "Organización",
  other: "Otra",
};
