/**
 * ARCHIVO: chat/types.ts
 *
 * ¿Qué es?
 * Son las "fichas de forma" del chat: cómo se ve un mensaje, lo que se envía al asistente, y la
 * respuesta con sus resultados y fuentes citadas. Describen la forma de los datos, sin dibujar nada.
 *
 * ¿Para qué sirve?
 * TypeScript usa estas fichas para avisar si se escribe mal un campo o un rol que no existe.
 *
 * ¿Quién lo usa?
 * ChatTab.tsx y api.ts. El archivo de pruebas chat.test.tsx también lo usa.
 */

/* Nivel de confianza y estado de revisión, de la carpeta de resultados. */
import type { Level, ReviewStatus } from "../findings/types";
/* Nombre del proveedor de IA y tema de resultado, de la carpeta de investigación. */
import type { AIProviderName, ResearchCategory } from "../research/types";
/* Origen (IA o persona), de la carpeta de proyectos. */
import type { Origin } from "../projects/types";

/**
 * ChatRole es quién escribió el mensaje: "user" (la persona) o "assistant" (el asistente).
 */
/** Describe el contrato chat role utilizado por chat. */
export type ChatRole = "user" | "assistant";

/**
 * ChatTurn es un mensaje de la conversación: quién lo escribió (role) y su texto (content).
 * Es lo mínimo que se envía como historial.
 */
/** Describe el contrato chat turn utilizado por chat. */
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

/**
 * ChatRequest es lo que se envía al servidor: la pregunta nueva (message) y los mensajes previos
 * (history), para que el asistente tenga contexto.
 */
/** Describe el contrato chat request utilizado por chat. */
export interface ChatRequest {
  message: string;
  history: ChatTurn[];
}

/**
 * ChatEvidenceReference es una fuente citada dentro de una respuesta:
 * - stance: si respalda ("supports"), contradice ("contradicts") o solo da contexto ("context").
 * - content: el fragmento citado.
 * - source_url: la dirección de la fuente (puede ser null).
 * - source_title: el título de la fuente (puede ser null).
 * - source_domain: el dominio de la fuente (siempre viene).
 */
/** Describe el contrato chat evidence reference utilizado por chat. */
export interface ChatEvidenceReference {
  stance: "supports" | "contradicts" | "context";
  content: string;
  source_url: string | null;
  source_title: string | null;
  source_domain: string;
}

/**
 * ChatFindingReference es un resultado citado en la respuesta: su id, tema, frase, confianza,
 * origen, revisión y sus fuentes (evidence).
 */
/** Describe el contrato chat finding reference utilizado por chat. */
export interface ChatFindingReference {
  id: string;
  finding_type: ResearchCategory;
  statement: string;
  confidence_level: Level;
  origin: Origin;
  review_status: ReviewStatus;
  evidence: ChatEvidenceReference[];
}

/**
 * ChatReply es la respuesta completa del servidor:
 * - answer: el texto del asistente.
 * - references: los resultados en que se apoya.
 * - provider y model: qué IA respondió (puede ser null). La pantalla de chat no los muestra.
 */
/** Describe el contrato chat reply utilizado por chat. */
export interface ChatReply {
  answer: string;
  references: ChatFindingReference[];
  provider: AIProviderName | null;
  model: string | null;
}
