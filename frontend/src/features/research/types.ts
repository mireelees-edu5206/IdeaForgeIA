/**
 * ARCHIVO: research/types.ts
 *
 * ¿Qué es?
 * Son las "fichas de forma" de la investigación en internet: cómo es una búsqueda (un "run"),
 * sus preguntas, las fuentes que consultó, los fragmentos de texto que sirven de evidencia
 * y la lista de fuentes del proyecto.
 *
 * ¿Para qué sirve?
 * TypeScript usa estas fichas para avisar si se escribe mal un estado o un campo.
 * Por ejemplo, si una búsqueda puede estar "running" pero no "corriendo", el código no compila.
 *
 * ¿Quién lo usa?
 * api.ts, queries.ts, constants.ts y todas las pantallas y componentes de research.
 *
 * Este archivo no dibuja nada: solo describe datos.
 *
 * Vocabulario que aparece aquí:
 * - "Run" = una ejecución de investigación completa sobre un proyecto. Puede haber varias.
 * - "Query" = una pregunta concreta que la IA investiga dentro de una ejecución.
 * - "Source" = una página de internet consultada.
 * - "Evidence" = un fragmento de texto de una fuente que respalda una afirmación.
 */

/**
 * RunStatus es el estado general de una investigación:
 * - "pending": en cola, todavía no empieza.
 * - "running": en curso.
 * - "completed": terminó bien.
 * - "failed": terminó con error.
 * - "interrupted": se cortó (por ejemplo, el servidor se reinició a la mitad).
 */
export type RunStatus = "pending" | "running" | "completed" | "failed" | "interrupted";

/**
 * RunStep es el paso en el que va la investigación mientras corre:
 * preparar la búsqueda, buscar en la web, organizar resultados, revisarlos y estimar su solidez.
 */
/** Describe el contrato run step utilizado por research. */
export type RunStep = "planning" | "searching" | "extracting" | "analyzing" | "scoring";

/**
 * QueryStatus es el estado de una pregunta concreta:
 * "pending" (esperando respuesta), "completed" (respondida) o "failed" (sin respuesta).
 */
/** Describe el contrato query status utilizado por research. */
export type QueryStatus = "pending" | "completed" | "failed";

/**
 * AIProviderName es qué inteligencia artificial hizo la investigación:
 * "gemini" (servicio de Google), "ollama" (IA que corre en la computadora), "fake" (datos de demostración)
 * o "legacy" (un proveedor antiguo que ya no se usa, guardado en el historial).
 */
/** Describe el contrato aiprovider name utilizado por research. */
export type AIProviderName = "gemini" | "ollama" | "fake" | "legacy";

/**
 * ResearchCategory es el tema de cada pregunta: mercado, clientes, competencia, sustitutos,
 * tecnología, regulación, precios u otros.
 */
/** Describe el contrato research category utilizado por research. */
export type ResearchCategory =
  | "market"
  | "customers"
  | "competition"
  | "substitutes"
  | "technology"
  | "regulation"
  | "pricing"
  | "other";

/**
 * SourceType es el tipo de sitio de una fuente: noticia, sitio de empresa, gobierno, académica,
 * marketplace, red social, blog, reseñas, otra o sin clasificar.
 */
/** Describe el contrato source type utilizado por research. */
export type SourceType =
  | "news"
  | "company_site"
  | "government"
  | "academic"
  | "marketplace"
  | "social"
  | "blog"
  | "review_site"
  | "other"
  | "unknown";

/**
 * ResearchRun es la ficha resumida de una investigación:
 * - id: su identificador.
 * - status: en qué estado va (ver RunStatus).
 * - current_step: el paso en curso (ver RunStep), o null si no hay un paso activo que mostrar.
 * - progress_pct: avance de 0 a 100.
 * - ai_provider y ai_model: qué IA y qué modelo la hicieron.
 * - error_code y error_message: el motivo si falló (o null si no hubo error).
 * - started_at y finished_at: cuándo empezó y terminó (o null si no ha pasado).
 * - created_at: cuándo se creó.
 */
/** Describe el contrato research run utilizado por research. */
export interface ResearchRun {
  id: string;
  status: RunStatus;
  current_step: RunStep | null;
  progress_pct: number;
  ai_provider: AIProviderName;
  ai_model: string;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

/**
 * QuerySource es una fuente dentro de una pregunta concreta:
 * - source_id: el identificador de la fuente en el proyecto (sirve para unir datos).
 * - url, domain, title: dirección, dominio y título de la página (el título puede faltar).
 * - source_type: el tipo de sitio.
 * - was_cited: true si la respuesta usó un fragmento de esta fuente; false si solo se consultó.
 * - rank: el lugar que ocupó en los resultados (o null si no se sabe).
 */
/** Describe el contrato query source utilizado por research. */
export interface QuerySource {
  source_id: string;
  url: string;
  domain: string;
  title: string | null;
  source_type: SourceType;
  was_cited: boolean;
  rank: number | null;
}

/**
 * Evidence es un fragmento de texto que respalda una parte de la respuesta:
 * - content: el texto tomado de la fuente.
 * - span_start y span_end: en qué posición de la respuesta cae ese fragmento (o null si no se ubicó).
 *   Con estas dos posiciones la pantalla puede resaltar exactamente qué frase está respaldada.
 */
/** Describe el contrato evidence utilizado por research. */
export interface Evidence {
  id: string;
  source_id: string;
  content: string;
  span_start: number | null;
  span_end: number | null;
}

/**
 * ResearchQuery es una pregunta dentro de una investigación, con todo lo que se obtuvo:
 * - question: el texto de la pregunta.
 * - category: su tema (mercado, clientes...).
 * - status: si ya se respondió, falló o sigue pendiente.
 * - response_text: la respuesta de la IA (o null si no hay).
 * - executed_queries: las búsquedas que la IA hizo en internet para responderla.
 * - search_suggestions_html: fragmento HTML de sugerencias de búsqueda de Google (o null).
 * - completed_at: cuándo terminó (o null).
 * - sources: las fuentes consultadas para esta pregunta.
 * - evidence: los fragmentos que respaldan la respuesta.
 */
/** Describe el contrato research query utilizado por research. */
export interface ResearchQuery {
  id: string;
  position: number;
  category: ResearchCategory;
  question: string;
  status: QueryStatus;
  response_text: string | null;
  executed_queries: string[];
  search_suggestions_html: string | null;
  completed_at: string | null;
  sources: QuerySource[];
  evidence: Evidence[];
}

/**
 * ResearchRunDetail es la investigación completa: la ficha resumida más la lista de sus preguntas.
 * Es lo que se pide cuando la persona abre una búsqueda concreta.
 */
/** Describe el contrato research run detail utilizado por research. */
export interface ResearchRunDetail extends ResearchRun {
  queries: ResearchQuery[];
}

/**
 * Source es una fuente del proyecto (la pestaña "Fuentes"). Es diferente de QuerySource:
 * aquí está la fuente a nivel de proyecto, con cuántas veces se citó y cuántos fragmentos aportó.
 * - citation_count: en cuántas preguntas se citó.
 * - evidence_count: cuántos fragmentos de evidencia aportó en total.
 */
/** Describe el contrato source utilizado por research. */
export interface Source {
  id: string;
  url: string;
  domain: string;
  title: string | null;
  source_type: SourceType;
  created_at: string;
  citation_count: number;
  evidence_count: number;
}
