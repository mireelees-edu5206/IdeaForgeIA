/**
 * ARCHIVO: analysis/types.ts
 *
 * ¿Qué es?
 * Son las "fichas de forma" del análisis: las cuatro listas que forman el análisis de una idea
 * (oportunidades, riesgos, suposiciones a comprobar y preguntas sin responder) y los datos que
 * tiene cada elemento. Describen la forma de los datos, sin dibujar nada.
 *
 * ¿Para qué sirve?
 * TypeScript usa estas fichas para avisar si se escribe mal un campo, un nivel o un estado que no existe.
 *
 * ¿Quién lo usa?
 * api.ts, queries.ts, constants.ts y las pantallas y tarjetas del análisis.
 *
 * Vocabulario:
 * - "Oportunidad": una señal que podría ayudar a que la idea funcione.
 * - "Riesgo": una situación que podría complicarla.
 * - "Suposición a comprobar" (hipótesis): algo que la idea supone y que conviene probar.
 * - "Pregunta sin responder" (información faltante): un dato que todavía no se tiene.
 * - "Kind" (tipo): cada una de esas cuatro listas.
 */

/* Estado de revisión (sin revisar, aceptado, rechazado), de la carpeta de resultados. */
import type { ReviewStatus } from "../findings/types";
/* Tipo de dato de la idea (problema, solución...) y origen (IA o persona), de la carpeta de proyectos. */
import type { AttributeType, Origin } from "../projects/types";
/* Nivel (alto, medio, bajo o indeterminado), también de la carpeta de resultados. */
import type { Level } from "../findings/types";

/** Priority es la prioridad de una suposición o pregunta: "low" (baja), "medium" (media) o "high" (alta). */
/** Describe el contrato priority utilizado por analysis. */
export type Priority = "low" | "medium" | "high";
/**
 * RiskCategory es el tipo de riesgo: mercado, competencia, técnico, regulatorio, financiero, operativo u otro.
 */
/** Describe el contrato risk category utilizado por analysis. */
export type RiskCategory = "market" | "competition" | "technical" | "regulatory" | "financial" | "operational" | "other";
/**
 * ValidationStatus es el avance de comprobar una suposición: "pending" (pendiente), "in_progress" (en curso),
 * "validated" (comprobada), "invalidated" (no se cumplió) o "inconclusive" (no se pudo concluir).
 */
/** Describe el contrato validation status utilizado por analysis. */
export type ValidationStatus = "pending" | "in_progress" | "validated" | "invalidated" | "inconclusive";
/**
 * ResolutionStatus es el estado de una pregunta sin responder: "open" (abierta), "resolved" (resuelta)
 * o "dismissed" (descartada, por ejemplo porque ya no importa).
 */
/** Describe el contrato resolution status utilizado por analysis. */
export type ResolutionStatus = "open" | "resolved" | "dismissed";
/**
 * AnalysisKindKey es el nombre de cada lista del análisis, tal como aparece en las direcciones del servidor:
 * "opportunities", "risks", "hypotheses" o "missing-information".
 */
/** Describe el contrato analysis kind key utilizado por analysis. */
export type AnalysisKindKey = "opportunities" | "risks" | "hypotheses" | "missing-information";

/**
 * FindingBrief es una ficha corta de un resultado que respalda un elemento del análisis:
 * su id, su tema, su frase, su confianza y su revisión. Así el análisis muestra de dónde sale cada cosa.
 */
/** Describe el contrato finding brief utilizado por analysis. */
export interface FindingBrief {
  id: string;
  finding_type: string;
  statement: string;
  confidence_level: Level;
  review_status: ReviewStatus;
}

/**
 * AnalysisItemBase son los datos que comparten TODOS los elementos del análisis:
 * - id, run_id (de qué búsqueda sale, o null), origin (IA o persona) y review_status (revisión).
 * - created_at y updated_at: fechas de creación y última modificación.
 * - findings: los resultados que lo respaldan.
 */
/** Describe el contrato analysis item base utilizado por analysis. */
export interface AnalysisItemBase {
  id: string;
  run_id: string | null;
  origin: Origin;
  review_status: ReviewStatus;
  created_at: string;
  updated_at: string;
  findings: FindingBrief[];
}

/**
 * Opportunity es una oportunidad: un título, su descripción (la interpretación) y su potencial
 * estimado (alto, medio, bajo o sin determinar).
 */
/** Describe el contrato opportunity utilizado por analysis. */
export interface Opportunity extends AnalysisItemBase {
  title: string;
  description: string;
  potential: Level;
}

/**
 * Risk es un riesgo: título, descripción, categoría, probabilidad e impacto (cada uno con su nivel),
 * y una posible mitigación (puede faltar).
 */
/** Describe el contrato risk utilizado por analysis. */
export interface Risk extends AnalysisItemBase {
  title: string;
  description: string;
  category: RiskCategory;
  likelihood: Level;
  impact: Level;
  mitigation: string | null;
}

/**
 * ValidationHypothesis es una suposición a comprobar: el enunciado, la parte de la idea a la que se
 * refiere (o null), cómo comprobarla, qué resultado daría confianza, su prioridad, su avance
 * y las notas del resultado.
 */
/** Describe el contrato validation hypothesis utilizado por analysis. */
export interface ValidationHypothesis extends AnalysisItemBase {
  statement: string;
  related_attribute: AttributeType | null;
  validation_method: string | null;
  success_criteria: string | null;
  priority: Priority;
  validation_status: ValidationStatus;
  result_notes: string | null;
}

/**
 * MissingInformation es una pregunta sin responder: la pregunta, por qué importa (reason),
 * a qué parte de la idea se refiere, su prioridad, su estado y sus notas.
 */
/** Describe el contrato missing information utilizado por analysis. */
export interface MissingInformation extends AnalysisItemBase {
  question: string;
  reason: string | null;
  related_attribute: AttributeType | null;
  priority: Priority;
  resolution_status: ResolutionStatus;
  resolution_notes: string | null;
}

/**
 * AnalysisOverview es el análisis completo: las cuatro listas juntas.
 * Es lo que devuelve el servidor cuando se pide el análisis de un proyecto.
 */
/** Describe el contrato analysis overview utilizado por analysis. */
export interface AnalysisOverview {
  opportunities: Opportunity[];
  risks: Risk[];
  hypotheses: ValidationHypothesis[];
  missing_information: MissingInformation[];
}

/**
 * Los tipos "...Input" describen lo que se manda al CREAR un elemento. Toman solo los campos
 * que la persona puede escribir (Pick) y agregan finding_ids: los resultados que lo respaldan.
 * "Pick" significa "elige solo estos campos de la ficha original".
 */
/** Describe el contrato opportunity input utilizado por analysis. */
export type OpportunityInput = Pick<Opportunity, "title" | "description" | "potential"> & { finding_ids: string[] };
/** Describe el contrato risk input utilizado por analysis. */
export type RiskInput =
  Pick<Risk, "title" | "description" | "category" | "likelihood" | "impact" | "mitigation"> & {
    finding_ids: string[];
  };
/** Describe el contrato hypothesis input utilizado por analysis. */
export type HypothesisInput =
  Pick<ValidationHypothesis, "statement" | "related_attribute" | "validation_method" | "success_criteria" | "priority"> & {
    finding_ids: string[];
  };
/**
 * MissingInformationInput no lleva finding_ids: una pregunta sin responder por definición todavía no
 * tiene resultados que la respalden.
 */
/** Describe el contrato missing information input utilizado por analysis. */
export type MissingInformationInput =
  Pick<MissingInformation, "question" | "reason" | "related_attribute" | "priority">;

/**
 * AnalysisCreateInput es el paquete para crear un elemento: el tipo ("kind") y sus datos.
 * Es una "unión": según el tipo, los datos cambian. Así TypeScript revisa que cada tipo lleve sus campos.
 */
/** Describe el contrato analysis create input utilizado por analysis. */
export type AnalysisCreateInput =
  | { kind: "opportunities"; data: OpportunityInput }
  | { kind: "risks"; data: RiskInput }
  | { kind: "hypotheses"; data: HypothesisInput }
  | { kind: "missing-information"; data: MissingInformationInput };

/** AnalysisItem es cualquier elemento del análisis (una oportunidad, un riesgo, una suposición o una pregunta). */
/** Describe el contrato analysis item utilizado por analysis. */
export type AnalysisItem = Opportunity | Risk | ValidationHypothesis | MissingInformation;
/**
 * AnalysisUpdate son los campos que se pueden cambiar de un elemento existente. Cada línea de la unión
 * corresponde a un tipo: "Partial" significa que basta con enviar solo algunos de esos campos.
 */
/** Describe el contrato analysis update utilizado por analysis. */
export type AnalysisUpdate =
  | Partial<Pick<Opportunity, "title" | "description" | "potential" | "review_status">>
  | Partial<Pick<Risk, "title" | "description" | "category" | "likelihood" | "impact" | "mitigation" | "review_status">>
  | Partial<
      Pick<
        ValidationHypothesis,
        "statement" | "related_attribute" | "validation_method" | "success_criteria" | "priority" | "review_status" | "validation_status" | "result_notes"
      >
    >
  | Partial<
      Pick<
        MissingInformation,
        "question" | "reason" | "related_attribute" | "priority" | "review_status" | "resolution_status" | "resolution_notes"
      >
    >;
