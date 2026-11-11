/**
 * ARCHIVO: research/constants.ts
 *
 * ¿Qué es?
 * Es la "hoja de textos y colores fijos" de la investigación: los nombres que ve la persona
 * (En cola, Buscando información en la web, Mercado, Noticia...), los colores de cada estado,
 * el ritmo con que se actualiza el progreso y una función de seguridad para los enlaces.
 *
 * ¿Para qué sirve?
 * Cambiar un nombre o un color de la investigación se hace aquí, en un solo lugar.
 *
 * ¿Quién lo usa?
 * ResearchTab.tsx, SourcesTab.tsx, queries.ts, RunStatusCard.tsx, QueryCard.tsx, badges.tsx y
 * CitedText.tsx, entre otros.
 */

/* Tipos que usamos para etiquetar cada valor (estados, pasos, categorías...). */
import type { AIProviderName, QueryStatus, ResearchCategory, RunStatus, RunStep, SourceType } from "./types";

/**
 * ACTIVE_RUN_STATUSES son los estados que significan "todavía trabajando": en cola o en curso.
 * Mientras una investigación esté en uno de estos estados, la pantalla sigue preguntando su progreso.
 */
/** Define active run statuses como dato o funcion publica de research. */
export const ACTIVE_RUN_STATUSES: RunStatus[] = ["pending", "running"];

/**
 * isActiveRun dice si una investigación todavía está trabajando.
 * Recibe un estado y devuelve true (sigue en curso) o false (ya terminó, sea bien o mal).
 */
/** Define is active run como dato o funcion publica de research. */
export const isActiveRun = (status: RunStatus) => ACTIVE_RUN_STATUSES.includes(status);

/**
 * RUN_POLL_INTERVAL_MS es cada cuántos milisegundos se pregunta el progreso mientras corre.
 * 2000 milisegundos = 2 segundos. Si lo subes, el progreso se ve más lento; si lo bajas, consume más peticiones.
 */
/** Intervalo de consulta del progreso mientras la investigación está en curso. */
export const RUN_POLL_INTERVAL_MS = 2000;

/**
 * RUN_STATUS_META asigna a cada estado de investigación su texto y sus colores:
 * "En cola" (gris), "En curso" (ámbar), "Completada" (verde), "Fallida" (rojo) e "Interrumpida" (naranja).
 */
/** Define run status meta como dato o funcion publica de research. */
export const RUN_STATUS_META: Record<RunStatus, { label: string; className: string }> = {
  pending: { label: "En cola", className: "text-slate-200 bg-slate-400/15 ring-slate-300/25" },
  running: { label: "En curso", className: "text-amber-200 bg-amber-400/15 ring-amber-300/30" },
  completed: { label: "Completada", className: "text-emerald-200 bg-emerald-400/15 ring-emerald-300/30" },
  failed: { label: "Fallida", className: "text-rose-200 bg-rose-400/15 ring-rose-300/30" },
  interrupted: { label: "Interrumpida", className: "text-orange-200 bg-orange-400/15 ring-orange-300/30" },
};

/**
 * RUN_STEP_LABELS traduce cada paso técnico a una frase que entiende cualquier persona.
 * Por ejemplo, "searching" se muestra como "Buscando información en la web".
 */
/** Define run step labels como dato o funcion publica de research. */
export const RUN_STEP_LABELS: Record<RunStep, string> = {
  planning: "Preparando qué vamos a buscar",
  searching: "Buscando información en la web",
  extracting: "Organizando los resultados encontrados",
  analyzing: "Revisando la información",
  scoring: "Estimando qué tan sólida es",
};

/** QUERY_STATUS_LABELS: el texto que se muestra para cada estado de una pregunta. */
/** Define query status labels como dato o funcion publica de research. */
export const QUERY_STATUS_LABELS: Record<QueryStatus, string> = {
  pending: "Pendiente",
  completed: "Respondida",
  failed: "Sin respuesta",
};

/**
 * CATEGORY_LABELS: el nombre en español de cada categoría de pregunta.
 * Estos mismos nombres los usan las gráficas de Visualizaciones (ver la sección 12 de la guía).
 */
/** Define category labels como dato o funcion publica de research. */
export const CATEGORY_LABELS: Record<ResearchCategory, string> = {
  market: "Mercado",
  customers: "Clientes",
  competition: "Competencia",
  substitutes: "Sustitutos",
  technology: "Tecnología",
  regulation: "Regulación",
  pricing: "Precios",
  other: "Otros",
};

/** SOURCE_TYPE_LABELS: el nombre en español de cada tipo de fuente. */
/** Define source type labels como dato o funcion publica de research. */
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  news: "Noticia",
  company_site: "Sitio de empresa",
  government: "Gobierno",
  academic: "Académica",
  marketplace: "Marketplace",
  social: "Red social",
  blog: "Blog",
  review_site: "Reseñas",
  other: "Otra",
  unknown: "Sin clasificar",
};

/**
 * PROVIDER_LABELS: el nombre que se muestra de cada IA. Solo se usa en la parte de administración,
 * porque las pantallas normales no muestran qué IA trabajó (regla de privacidad del proyecto).
 */
/** Define provider labels como dato o funcion publica de research. */
export const PROVIDER_LABELS: Record<AIProviderName, string> = {
  engine: "Motor IdeaForge (Python)",
  fake: "Proveedor de pruebas",
  legacy: "Proveedor histórico",
};

/**
 * safeHref revisa un enlace antes de mostrarlo como enlace clicable.
 * Solo acepta direcciones que empiezan con "https:" o "http:". Cualquier otra cosa
 * (por ejemplo "javascript:...") se descarta: así no se puede esconder código malicioso en un enlace.
 *
 * Recibe: la dirección tal como vino del servidor.
 * Devuelve: la misma dirección si es segura, o undefined si no lo es.
 *
 * Es una defensa extra: el backend ya filtra las direcciones, pero aquí las volvemos a revisar.
 */
/** Defensa adicional: solo se enlazan URLs http(s) aunque el backend ya las filtra. */
export function safeHref(url: string): string | undefined {
  // "try" protege de direcciones mal formadas: si "new URL" falla, caemos en "catch".
  /** Maneja fallos de la operacion del bloque investigacion. */
  try {
    // "new URL" separa la dirección en partes. Aquí tomamos solo el protocolo (la parte del inicio, por ejemplo "https:").
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? url : undefined;
  } catch {
    // Dirección inválida: no la mostramos como enlace.
    return undefined;
  }
}
