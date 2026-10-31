/**
 * ARCHIVO: research/components/badges.tsx
 *
 * ¿Qué es?
 * Son tres "stickers" pequeños de la investigación:
 * - RunStatusBadge: el estado de una búsqueda ("En curso", "Completada"...).
 * - CategoryBadge: el tema de una pregunta ("Mercado", "Clientes"...).
 * - SourceTypeBadge: el tipo de sitio de una fuente ("Noticia", "Gobierno"...).
 *
 * ¿Para qué sirve?
 * Para leer de un vistazo la información importante sin tener que abrir cada tarjeta.
 *
 * ¿Quién lo usa?
 * RunStatusCard.tsx, QueryCard.tsx, SourcesTab.tsx (fuentes) y ResearchTab.tsx.
 */

/* La etiqueta base de la app (forma redondeada); aquí solo le ponemos texto y color. */
import { Badge } from "../../../components/ui/Badge";
/* Los nombres en español y los colores de cada valor. */
import { CATEGORY_LABELS, RUN_STATUS_META, SOURCE_TYPE_LABELS } from "../constants";
/* Tipos de estado, categoría y tipo de fuente. */
import type { ResearchCategory, RunStatus, SourceType } from "../types";

/**
 * RunStatusBadge muestra el estado de una búsqueda con su color (tomado de RUN_STATUS_META).
 *
 * Recibe: status (el estado actual de la búsqueda).
 */
/** Expone la funcion run status badge para el flujo de research. */
export function RunStatusBadge({ status }: { status: RunStatus }) {
  // Del diccionario sacamos el texto y el color de este estado.
  const { label, className } = RUN_STATUS_META[status];
  return <Badge className={className}>{label}</Badge>;
}

/**
 * CategoryBadge muestra el tema de una pregunta. El color es violeta fijo para todas las categorías,
 * así el tema se distingue de los estados (que tienen colores propios).
 *
 * Recibe: category (por ejemplo "market").
 */
/** Expone la funcion category badge para el flujo de research. */
export function CategoryBadge({ category }: { category: ResearchCategory }) {
  return <Badge className="bg-accent-violet/10 text-violet-200 ring-accent-violet/30">{CATEGORY_LABELS[category]}</Badge>;
}

/**
 * SourceTypeBadge muestra el tipo de sitio de una fuente con un estilo gris neutro.
 * El gris es intencional: el tipo es información de apoyo, no algo que deba llamar la atención.
 *
 * Recibe: type (por ejemplo "academic").
 */
/** Expone la funcion source type badge para el flujo de research. */
export function SourceTypeBadge({ type }: { type: SourceType }) {
  return <Badge className="bg-slate-400/12 text-slate-300 ring-slate-400/25">{SOURCE_TYPE_LABELS[type]}</Badge>;
}
