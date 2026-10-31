/**
 * ARCHIVO: analysis/constants.ts
 *
 * ¿Qué es?
 * Es la "hoja de textos fijos" del análisis: los nombres en español de prioridades, categorías de riesgo,
 * estados de validación, estados de resolución y de cada parte de la idea.
 *
 * ¿Para qué sirve?
 * Para que la persona vea "Alta", "Regulatorio" o "No validada" en lugar de códigos como "high" o "regulatory".
 * Cambiar un nombre se hace aquí, en un solo lugar.
 *
 * ¿Quién lo usa?
 * AnalysisItemCard.tsx, AnalysisItemForm.tsx, AnalysisTab.tsx (vía las opciones de los menús).
 *
 * Cada constante es un "diccionario": a partir de un código (por ejemplo "high") se obtiene su texto
 * escribiendo el código entre corchetes: PRIORITY_LABELS["high"] → "Alta".
 */

/* Tipos de prioridad, categoría de riesgo, validación y resolución, definidos en types.ts. */
import type { AttributeType } from "../projects/types";
import type { Priority, ResolutionStatus, RiskCategory, ValidationStatus } from "./types";

/**
 * LEVEL_LABELS: el nombre en español de cada nivel de potencial, probabilidad o impacto.
 * "as const" le dice a TypeScript que estos textos son fijos (no se pueden cambiar en tiempo de ejecución).
 */
/** Define level labels como dato o funcion publica de analysis. */
export const LEVEL_LABELS = { high: "Alta", medium: "Media", low: "Baja", undetermined: "Indeterminada" } as const;
/** PRIORITY_LABELS: el nombre en español de cada prioridad (alta, media, baja). */
/** Define priority labels como dato o funcion publica de analysis. */
export const PRIORITY_LABELS: Record<Priority, string> = { high: "Alta", medium: "Media", low: "Baja" };
/** RISK_CATEGORY_LABELS: el nombre en español de cada tipo de riesgo (Mercado, Técnico, Regulatorio...). */
/** Define risk category labels como dato o funcion publica de analysis. */
export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  market: "Mercado",
  competition: "Competencia",
  technical: "Técnico",
  regulatory: "Regulatorio",
  financial: "Financiero",
  operational: "Operativo",
  other: "Otro",
};
/**
 * VALIDATION_STATUS_LABELS: el texto de avance de una suposición. Por ejemplo, "invalidated" se muestra
 * como "No validada", que es más claro que la palabra técnica.
 */
/** Define validation status labels como dato o funcion publica de analysis. */
export const VALIDATION_STATUS_LABELS: Record<ValidationStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  validated: "Validada",
  invalidated: "No validada",
  inconclusive: "Inconclusa",
};
/** RESOLUTION_STATUS_LABELS: el texto de estado de una pregunta sin responder ("Pendiente", "Resuelta", "Descartada"). */
/** Define resolution status labels como dato o funcion publica de analysis. */
export const RESOLUTION_STATUS_LABELS: Record<ResolutionStatus, string> = {
  open: "Pendiente",
  resolved: "Resuelta",
  dismissed: "Descartada",
};
/**
 * ATTRIBUTE_LABELS: el nombre corto de cada parte de la idea, para mostrar "Parte de la idea relacionada: Canales".
 * Es parecido a ATTRIBUTE_META de la carpeta de proyectos, pero solo con el nombre.
 */
/** Define attribute labels como dato o funcion publica de analysis. */
export const ATTRIBUTE_LABELS: Record<AttributeType, string> = {
  problem: "Problema",
  solution: "Solución",
  customer_segment: "Segmento de clientes",
  product_service: "Producto o servicio",
  channels: "Canales",
  revenue_model: "Modelo de ingresos",
  geographic_scope: "Alcance geográfico",
  differentiators: "Diferenciadores",
  technologies: "Tecnologías",
};
