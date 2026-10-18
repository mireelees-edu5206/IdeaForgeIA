import type { CompetitorType, EntityType, EvidenceStance, Level, ReviewStatus } from "./types";

export const STATEMENT_MAX_LENGTH = 2000;
export const RATIONALE_MAX_LENGTH = 2000;

export const LEVEL_VALUES: Level[] = ["high", "medium", "low", "undetermined"];

export const CONFIDENCE_META: Record<Level, { label: string; className: string }> = {
  high: { label: "Confianza alta", className: "text-emerald-200 bg-emerald-400/15 ring-emerald-300/30" },
  medium: { label: "Confianza media", className: "text-sky-200 bg-sky-400/15 ring-sky-300/30" },
  low: { label: "Confianza baja", className: "text-amber-200 bg-amber-400/15 ring-amber-300/30" },
  undetermined: { label: "Confianza indeterminada", className: "text-slate-300 bg-slate-400/15 ring-slate-300/25" },
};

export const LEVEL_LABELS: Record<Level, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
  undetermined: "Indeterminada",
};

export const THREAT_META: Record<Level, { label: string; className: string }> = {
  high: { label: "Amenaza alta", className: "text-rose-200 bg-rose-400/15 ring-rose-300/30" },
  medium: { label: "Amenaza media", className: "text-amber-200 bg-amber-400/15 ring-amber-300/30" },
  low: { label: "Amenaza baja", className: "text-emerald-200 bg-emerald-400/15 ring-emerald-300/30" },
  undetermined: { label: "Amenaza indeterminada", className: "text-slate-300 bg-slate-400/15 ring-slate-300/25" },
};

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  proposed: "Sin revisar",
  accepted: "Aceptado",
  rejected: "Rechazado",
};

export const STANCE_META: Record<EvidenceStance, { label: string; className: string }> = {
  supports: { label: "Respalda", className: "text-kind-evidence bg-kind-evidence/10 ring-kind-evidence/30" },
  contradicts: { label: "Contradice", className: "text-rose-200 bg-rose-400/15 ring-rose-300/30" },
  context: { label: "Contexto", className: "text-slate-300 bg-slate-400/15 ring-slate-300/25" },
};

export const COMPETITOR_TYPES: CompetitorType[] = ["direct", "indirect", "substitute", "alternative"];

export const COMPETITOR_TYPE_META: Record<CompetitorType, { label: string; plural: string; description: string }> = {
  direct: {
    label: "Directo",
    plural: "Competidores directos",
    description: "Ofrecen una solución parecida al mismo segmento de clientes.",
  },
  indirect: {
    label: "Indirecto",
    plural: "Competidores indirectos",
    description: "Resuelven el mismo problema de otra manera o para otro segmento.",
  },
  substitute: {
    label: "Sustituto",
    plural: "Sustitutos",
    description: "Productos o servicios distintos que el cliente puede usar en su lugar.",
  },
  alternative: {
    label: "Alternativa",
    plural: "Alternativas",
    description: "Otras formas de resolverlo, incluido no hacer nada o hacerlo a mano.",
  },
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  company: "Empresa",
  product: "Producto",
  technology: "Tecnología",
  organization: "Organización",
  other: "Otra",
};
