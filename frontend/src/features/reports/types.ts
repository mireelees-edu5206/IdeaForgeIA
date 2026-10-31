/**
 * ARCHIVO: reports/types.ts
 *
 * ¿Qué es?
 * Son las "fichas de forma" del veredicto y de los informes: cómo se ve un informe, sus apartados,
 * el veredicto (recomendación, confianza, inversión y zonas) y las zonas que pide la persona evaluar.
 * Describen la forma de los datos, sin dibujar nada.
 *
 * ¿Para qué sirve?
 * TypeScript usa estas fichas para avisar si se escribe mal un campo o un valor que no existe
 * (por ejemplo, una recomendación con otro nombre).
 *
 * ¿Quién lo usa?
 * api.ts, queries.ts y ReportsTab.tsx.
 *
 * Vocabulario:
 * - "Informe" (report): un documento completo, generado a partir del proyecto. Puede tener varias versiones.
 * - "Veredicto" (verdict): la recomendación resumida que va dentro de un apartado del informe.
 * - "Apartado" (section): una parte del informe, con su título y su texto.
 */

/* Nombre del proveedor de IA (carpeta de investigación). Aquí sirve para saber si el informe es de demostración. */
import type { AIProviderName } from "../research/types";

/**
 * ReportStatus es el estado del informe: "generating" (generando), "completed" (listo) o "failed" (fallido).
 */
/** Describe el contrato report status utilizado por reports. */
export type ReportStatus = "generating" | "completed" | "failed";

/**
 * GeographicScopeInput es una zona que la persona quiere evaluar. Solo "query" (el nombre) es obligatorio.
 * Si también vienen latitude y longitude, el servidor puede usar esa ubicación exacta.
 * radius_m es el radio de búsqueda en metros (el servidor acepta de 100 a 5000; por defecto 1000).
 * keyword es el giro o tipo de negocio que se busca (opcional).
 */
/** Describe el contrato geographic scope input utilizado por reports. */
export interface GeographicScopeInput {
  query: string;
  latitude?: number;
  longitude?: number;
  radius_m?: number;
  keyword?: string;
}

/**
 * ReportSectionType es el tipo de apartado del informe: resumen ejecutivo, idea, mercado, competencia,
 * oportunidades, riesgos, suposiciones, información faltante, fuentes o conclusiones.
 */
/** Describe el contrato report section type utilizado por reports. */
export type ReportSectionType =
  | "executive_summary"
  | "idea_overview"
  | "market"
  | "competition"
  | "opportunities"
  | "risks"
  | "hypotheses"
  | "missing_information"
  | "sources"
  | "conclusions";

/**
 * VerdictInvestment es la estimación de inversión inicial, en pesos mexicanos (MXN):
 * - minimum_mxn y maximum_mxn: el rango.
 * - basis: en qué se basa la cifra.
 * - assumptions: los supuestos que se usaron.
 * - evidence_refs: las referencias a resultados (por ejemplo "E1") que respaldan la cifra.
 */
/** Describe el contrato verdict investment utilizado por reports. */
export interface VerdictInvestment {
  minimum_mxn: number;
  maximum_mxn: number;
  basis: string;
  assumptions: string[];
  evidence_refs: string[];
}

/**
 * VerdictZone es una zona evaluada dentro del veredicto:
 * - name: el nombre de la zona.
 * - reason: por qué se recomienda o no.
 * - place_refs: referencias a los lugares del mapa que la respaldan (por ejemplo "G1").
 * - caveat: la advertencia sobre lo que no se puede concluir.
 */
/** Describe el contrato verdict zone utilizado por reports. */
export interface VerdictZone {
  name: string;
  reason: string;
  place_refs: string[];
  caveat: string;
}

/**
 * BusinessVerdict es el veredicto completo:
 * - recommendation: una de cuatro recomendaciones (probar en pequeño, validar más, no avanzar, o datos insuficientes).
 * - confidence: qué tan seguro está el veredicto ("low", "medium" o "high").
 * - summary: el resumen en texto.
 * - investment: la inversión estimada, o null si no hay datos suficientes para estimarla.
 * - zones: las zonas evaluadas.
 * - missing_information: lo que todavía falta saber.
 * - next_steps: los siguientes pasos sugeridos.
 */
/** Describe el contrato business verdict utilizado por reports. */
export interface BusinessVerdict {
  recommendation: "worth_testing" | "needs_validation" | "do_not_proceed_yet" | "insufficient_information";
  confidence: "low" | "medium" | "high";
  summary: string;
  investment: VerdictInvestment | null;
  zones: VerdictZone[];
  missing_information: string[];
  next_steps: string[];
}

/**
 * ReportSection es un apartado del informe:
 * - id, section_type, position (orden), title y content (el texto).
 * - verdict: el veredicto estructurado. Solo el apartado de veredicto lo trae; los demás tienen null
 *   o no lo traen. El "?" significa que el campo puede faltar.
 */
/** Describe el contrato report section utilizado por reports. */
export interface ReportSection {
  id: string;
  section_type: ReportSectionType;
  position: number;
  title: string;
  content: string;
  verdict?: BusinessVerdict | null;
}

/**
 * Report es la ficha general de un informe:
 * - id, project_id, run_id (la búsqueda de la que sale; puede ser null), version (número de versión).
 * - title, status, ai_provider y ai_model (qué IA lo generó).
 * - error_code: el código del error si falló (o null).
 * - created_at y completed_at: cuándo se creó y cuándo terminó (completed_at puede ser null).
 */
/** Describe el contrato report utilizado por reports. */
export interface Report {
  id: string;
  project_id: string;
  run_id: string | null;
  version: number;
  title: string;
  status: ReportStatus;
  ai_provider: AIProviderName;
  ai_model: string;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * ReportListItem es un informe dentro de la lista: la ficha general más cuántos apartados tiene.
 * Es lo que devuelve el servidor al pedir la lista de informes del proyecto.
 */
/** Describe el contrato report list item utilizado por reports. */
export interface ReportListItem extends Report {
  section_count: number;
}

/**
 * ReportDetail es un informe completo: la ficha general más todos sus apartados (sections).
 * Es lo que devuelve el servidor al pedir un informe concreto.
 */
/** Describe el contrato report detail utilizado por reports. */
export interface ReportDetail extends Report {
  sections: ReportSection[];
}
