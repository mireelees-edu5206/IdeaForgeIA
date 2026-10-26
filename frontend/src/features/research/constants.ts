import type { AIProviderName, QueryStatus, ResearchCategory, RunStatus, RunStep, SourceType } from "./types";

export const ACTIVE_RUN_STATUSES: RunStatus[] = ["pending", "running"];
export const isActiveRun = (status: RunStatus) => ACTIVE_RUN_STATUSES.includes(status);

/** Intervalo de consulta del progreso mientras la investigación está en curso. */
export const RUN_POLL_INTERVAL_MS = 2000;

export const RUN_STATUS_META: Record<RunStatus, { label: string; className: string }> = {
  pending: { label: "En cola", className: "text-slate-200 bg-slate-400/15 ring-slate-300/25" },
  running: { label: "En curso", className: "text-amber-200 bg-amber-400/15 ring-amber-300/30" },
  completed: { label: "Completada", className: "text-emerald-200 bg-emerald-400/15 ring-emerald-300/30" },
  failed: { label: "Fallida", className: "text-rose-200 bg-rose-400/15 ring-rose-300/30" },
  interrupted: { label: "Interrumpida", className: "text-orange-200 bg-orange-400/15 ring-orange-300/30" },
};

export const RUN_STEP_LABELS: Record<RunStep, string> = {
  planning: "Preparando qué vamos a buscar",
  searching: "Buscando información en la web",
  extracting: "Organizando los resultados encontrados",
  analyzing: "Revisando la información",
  scoring: "Estimando qué tan sólida es",
};

export const QUERY_STATUS_LABELS: Record<QueryStatus, string> = {
  pending: "Pendiente",
  completed: "Respondida",
  failed: "Sin respuesta",
};

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

export const PROVIDER_LABELS: Record<AIProviderName, string> = {
  gemini: "Gemini",
  ollama: "Ollama (local)",
  fake: "Proveedor de pruebas",
  legacy: "Proveedor histórico",
};

/** Defensa adicional: solo se enlazan URLs http(s) aunque el backend ya las filtra. */
export function safeHref(url: string): string | undefined {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}
