/**
 * ARCHIVO: projects/types.ts
 *
 * ¿Qué es?
 * Son las "fichas de forma" de un proyecto: cómo se ve un proyecto, sus atributos (problema,
 * solución, cliente...), el resumen de la lista y las respuestas del servidor. Es como el formato
 * de una ficha de biblioteca: dice qué casillas tiene, no guarda el libro.
 *
 * ¿Para qué sirve?
 * TypeScript usa estas fichas para avisar si alguien escribe mal un campo ("titulo" en lugar de "title")
 * o usa un estado que no existe, antes de ejecutar la app.
 *
 * ¿Quién lo usa?
 * Casi todos los archivos de features/projects, y varias pantallas de investigación y análisis
 * que muestran datos de un proyecto.
 *
 * Este archivo no dibuja nada: solo describe datos.
 */

/**
 * ProjectStatus es la lista cerrada de etapas por las que pasa un proyecto, en orden:
 * - "draft": idea por completar (faltan datos).
 * - "structured": lista para investigar (los datos básicos ya están confirmados).
 * - "researching": investigación en curso o ya hecha.
 * - "analyzed": ya hay resultados y análisis.
 */
export type ProjectStatus = "draft" | "structured" | "researching" | "analyzed";

/**
 * AttributeType son los tipos de dato que puede tener la idea (las "casillas" de la idea).
 * Tres de ellos son obligatorios para investigar: problem, solution y customer_segment.
 * Los demás son opcionales y enriquecen la idea.
 */
/** Describe el contrato attribute type utilizado por projects. */
export type AttributeType =
  | "problem"
  | "solution"
  | "customer_segment"
  | "product_service"
  | "channels"
  | "revenue_model"
  | "geographic_scope"
  | "differentiators"
  | "technologies";

/**
 * Origin dice quién escribió un dato: "ai" (una sugerencia de la inteligencia artificial)
 * o "user" (la persona que usa la app). Sirve para mostrar la etiqueta correcta en cada dato.
 */
/** Describe el contrato origin utilizado por projects. */
export type Origin = "ai" | "user";

/**
 * ProjectSummary es la versión corta de un proyecto, la que aparece en la lista:
 * - id: identificador único.
 * - title: nombre del proyecto.
 * - status: en qué etapa está.
 * - created_at / updated_at: cuándo se creó y cuándo se modificó por última vez (texto con fecha y hora).
 */
/** Describe el contrato project summary utilizado por projects. */
export interface ProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Project es el proyecto completo en su versión básica: todo lo del resumen más la idea escrita
 * tal cual la escribió la persona (raw_idea).
 */
/** Describe el contrato project utilizado por projects. */
export interface Project extends ProjectSummary {
  raw_idea: string;
}

/**
 * IdeaAttribute es una "casilla" de la idea, por ejemplo el problema o el segmento:
 * - attribute_type: qué casilla es (ver AttributeType).
 * - value: el texto que la llena.
 * - position: el orden dentro de su casilla, por si hay varios valores.
 * - origin: si lo escribió la persona ("user") o la IA ("ai").
 * - is_confirmed: si la persona ya aceptó el dato. Un dato de IA sin confirmar es solo una propuesta.
 * - created_at / updated_at: fechas de creación y última modificación.
 */
/** Describe el contrato idea attribute utilizado por projects. */
export interface IdeaAttribute {
  id: string;
  attribute_type: AttributeType;
  value: string;
  position: number;
  origin: Origin;
  is_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * StructureCheck es el resultado de revisar si la idea está lista para investigar:
 * - ready: true si ya están los tres datos obligatorios confirmados.
 * - missing: la lista de datos obligatorios que todavía faltan.
 * - pending_suggestions: cuántas sugerencias de la IA aún no se han aceptado ni descartado.
 */
/** Describe el contrato structure check utilizado por projects. */
export interface StructureCheck {
  ready: boolean;
  missing: AttributeType[];
  pending_suggestions: number;
}

/**
 * ProjectDetail es el proyecto con todo su contenido: la versión básica más la lista de atributos
 * y el resultado de la revisión de estructura. Es lo que pide la pantalla de detalle.
 */
/** Describe el contrato project detail utilizado por projects. */
export interface ProjectDetail extends Project {
  attributes: IdeaAttribute[];
  structure: StructureCheck;
}

/**
 * ProjectsOverview es el resumen de todos los proyectos de la persona:
 * - total: cuántos tiene.
 * - by_status: cuántos hay en cada etapa (un número por cada ProjectStatus).
 */
/** Describe el contrato projects overview utilizado por projects. */
export interface ProjectsOverview {
  total: number;
  by_status: Record<ProjectStatus, number>;
}

/**
 * Page es una "hoja de página" de resultados. Las listas grandes se piden por partes:
 * - items: los elementos de esta página.
 * - total: cuántos hay en total (para calcular cuántas páginas existen).
 * - limit: cuántos elementos caben por página.
 * - offset: cuántos elementos se saltaron antes de esta página.
 * La "T" es un hueco: aquí se llena con el tipo de elemento (por ejemplo, proyectos).
 */
/** Describe el contrato page utilizado por projects. */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * ProjectInput son los datos para crear o editar un proyecto: el nombre y la idea escrita.
 */
/** Describe el contrato project input utilizado por projects. */
export interface ProjectInput {
  title: string;
  raw_idea: string;
}

/**
 * ProjectListParams son los filtros de la lista de proyectos: cuántos mostrar, desde dónde,
 * y opcionalmente solo los de una etapa. Si "status" no viene, se muestran todas las etapas.
 */
/** Describe el contrato project list params utilizado por projects. */
export interface ProjectListParams {
  limit: number;
  offset: number;
  status?: ProjectStatus;
}
