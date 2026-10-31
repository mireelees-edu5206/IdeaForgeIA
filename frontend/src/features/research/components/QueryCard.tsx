/**
 * ARCHIVO: research/components/QueryCard.tsx
 *
 * ¿Qué es?
 * Es la tarjeta de una pregunta de la investigación. Tiene una parte visible siempre (el tema,
 * el estado y la pregunta) y, al desplegarla, la respuesta con sus citas, las búsquedas que hizo
 * la IA, la lista de fuentes y las sugerencias de búsqueda de Google.
 *
 * ¿Para qué sirve?
 * Permite revisar cada pregunta por separado: qué se preguntó, qué respondió la IA, de dónde salió
 * cada dato y qué fuentes se consultaron pero no se citaron.
 *
 * ¿Quién lo usa?
 * ResearchTab.tsx, una tarjeta por cada pregunta. La primera viene abierta (defaultOpen).
 *
 * Detalle importante: "citada" significa que la respuesta usó un fragmento de esa fuente.
 * "Consultada, no citada" significa que se leyó pero no aportó texto a la respuesta.
 */

/* "useState" guarda qué fuentes están iluminadas en este momento (las que apunta el mouse o el teclado). */
import { useState } from "react";
/* Iconos: flecha que gira, alerta, enlace externo y lupa. */
import { FiAlertCircle, FiChevronDown, FiExternalLink, FiSearch } from "react-icons/fi";

/* El dibujo de hilo (trazabilidad) y el aviso de carga, de las piezas compartidas. */
import { FilamentBridgeGlyph } from "../../../components/ui/ForgeGlyphs";
import { Spinner } from "../../../components/ui/Spinner";
/* Une clases de estilo que pueden o no aparecer. */
import { cn } from "../../../lib/cn";
/* Textos de estado y la función de enlaces seguros. */
import { QUERY_STATUS_LABELS, safeHref } from "../constants";
/* Ficha de forma de una pregunta. */
import type { ResearchQuery } from "../types";
/* Etiquetas de categoría y de tipo de fuente. */
import { CategoryBadge, SourceTypeBadge } from "./badges";
/* El texto con las citas resaltadas. */
import { CitedText } from "./CitedText";
/* Las sugerencias de búsqueda de Google, aisladas en su propia ventana. */
import { SearchSuggestions } from "./SearchSuggestions";

/**
 * QueryCard dibuja una pregunta completa, desplegable.
 *
 * Recibe:
 * - query: la pregunta con todo lo que se obtuvo.
 * - defaultOpen: si es true, la tarjeta sale abierta desde el inicio.
 */
/** Expone la funcion query card para el flujo de research. */
export function QueryCard({ query, defaultOpen }: { query: ResearchQuery; defaultOpen: boolean }) {
  // Las fuentes que hay que iluminar ahora mismo (la lista de números, por ejemplo [2, 5]).
  const [highlightedSources, setHighlightedSources] = useState<number[]>([]);
  // Un prefijo único para los anclajes de esta tarjeta, así los números [n] no chocan con los de otras preguntas.
  const anchorPrefix = `fuente-${query.id}`;
  // Un mapa que dice qué número tiene cada fuente: la primera de la lista es 1, la segunda 2, etc.
  // "map" con "index + 1" crea los pares [id de la fuente, número].
  const sourceNumbers = new Map(query.sources.map((source, index) => [source.source_id, index + 1]));
  // Cuántas fuentes se citaron de verdad (no solo se consultaron).
  const cited = query.sources.filter((s) => s.was_cited).length;

  return (
    // "details" es un bloque que se despliega al tocarlo. "open" controla si arranca abierto.
    <details open={defaultOpen} className="surface-panel group rounded-2xl">
      {/* La parte de siempre visible: lo que aparece cuando la tarjeta está cerrada. */}
      {/* "list-none" y "[&::-webkit-details-marker]:hidden" quitan la flechita nativa del navegador, porque ya hay una propia. */}
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-3xl p-4 focus-visible:outline-2 sm:p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <CategoryBadge category={query.category} />
            {/* El estado de la pregunta. Si falló, se pinta en rojo. */}
            <span className={query.status === "failed" ? "text-rose-300" : undefined}>
              {QUERY_STATUS_LABELS[query.status]}
            </span>
            {/* Solo si se respondió: cuántas fuentes se citaron. "singular o plural" según el número. */}
            {query.status === "completed" && (
              <span>
                · {cited} {cited === 1 ? "fuente citada" : "fuentes citadas"}
              </span>
            )}
          </div>
          <h3 className="font-medium text-slate-100">{query.question}</h3>
        </div>
        {/* La flecha. "group-open:rotate-180" la gira cuando la tarjeta está abierta. */}
        <FiChevronDown aria-hidden="true" className="mt-1 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      {/* El contenido desplegable: aparece al abrir la tarjeta. */}
      <div className="flex flex-col gap-4 border-t border-slate-400/15 p-4 sm:p-5">
        {/* Mientras la pregunta espera respuesta, mostramos la ruedita. */}
        {query.status === "pending" && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-300">
            <Spinner className="size-4 text-accent-cyan" /> Esperando la respuesta…
          </p>
        )}
        {/* Si falló, explicamos que no hubo respuesta. */}
        {query.status === "failed" && (
          <p className="flex items-center gap-2 text-sm text-rose-200">
            <FiAlertCircle aria-hidden="true" /> No se pudo obtener respuesta para esta pregunta.
          </p>
        )}
        {/* La respuesta de la IA con sus citas. Solo si existe texto. */}
        {query.response_text && (
          <CitedText
            text={query.response_text}
            evidence={query.evidence}
            sourceNumbers={sourceNumbers}
            anchorPrefix={anchorPrefix}
            onHighlightSources={setHighlightedSources}
          />
        )}

        {/* Las búsquedas que la IA hizo en internet, como "chips" (pastillas). Solo si hubo alguna. */}
        {query.executed_queries.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-medium text-slate-400">Búsquedas realizadas por la IA</h4>
            <ul className="flex flex-wrap gap-2">
              {query.executed_queries.map((text) => (
                <li key={text} className="neo-inset flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-slate-300">
                  <FiSearch aria-hidden="true" className="size-3" /> {text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* La lista de fuentes de esta pregunta. Solo si hay alguna. */}
        {query.sources.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-medium text-slate-400">Fuentes</h4>
              {/* Cuando se pasa el mouse sobre una cita, aparece este indicador con las fuentes iluminadas. */}
              {highlightedSources.length > 0 && (
                <span className="font-mono-tech inline-flex items-center gap-1.5 text-[11px] text-kind-evidence">
                  <FilamentBridgeGlyph className="h-3.5 w-10" />
                  Hilo activo → [{highlightedSources.join(", ")}]
                </span>
              )}
            </div>
            <ol className="flex flex-col gap-2">
              {/* Cada fuente se dibuja con su número. "index + 1" es el número visible. */}
              {query.sources.map((source, index) => {
                const number = index + 1;
                // ¿Esta fuente está iluminada ahora mismo?
                const activeFilament = highlightedSources.includes(number);
                // Solo es enlace si la dirección es segura (http o https). Si no, se muestra como texto.
                const href = safeHref(source.url);
                return (
                  <li
                    key={source.source_id}
                    // El id permite que el número [n] de la respuesta baje hasta esta fila.
                    id={`${anchorPrefix}-${number}`}
                    className={cn(
                      // Estilo base de la fila. "target:ring-2" la resalta cuando se llega a ella desde un número [n].
                      "neo-inset flex scroll-mt-24 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-sm transition target:ring-2 target:ring-kind-evidence/60",
                      // Si está iluminada, se pinta con anillo y fondo verdes.
                      activeFilament && "ring-2 ring-kind-evidence bg-kind-evidence/10",
                    )}
                  >
                    <span className="font-mono-tech font-semibold text-kind-evidence">[{number}]</span>
                    {href ? (
                      // El título es un enlace que se abre en una pestaña nueva. "noopener noreferrer nofollow" protege la app.
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex min-w-0 items-center gap-1 break-all text-slate-100 hover:text-accent-cyan hover:underline"
                      >
                        {/* Si la fuente no tiene título, mostramos su dominio. */}
                        {source.title ?? source.domain}
                        <FiExternalLink aria-hidden="true" className="size-3 shrink-0" />
                        {/* Solo para lectores de pantalla: avisa que se abre en una pestaña nueva. */}
                        <span className="sr-only">(se abre en una pestaña nueva)</span>
                      </a>
                    ) : (
                      // Dirección no segura: solo se muestra el texto, sin enlace.
                      <span className="break-all text-slate-100">{source.title ?? source.domain}</span>
                    )}
                    <span className="text-xs text-slate-400">{source.domain}</span>
                    <SourceTypeBadge type={source.source_type} />
                    {/* Si se citó, en verde; si solo se consultó, en gris. */}
                    <span className={source.was_cited ? "text-xs text-kind-evidence" : "text-xs text-slate-500"}>
                      {source.was_cited ? "Citada" : "Consultada, no citada"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Las sugerencias de búsqueda de Google, si la respuesta las trae. */}
        {query.search_suggestions_html && <SearchSuggestions html={query.search_suggestions_html} />}
      </div>
    </details>
  );
}
